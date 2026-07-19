import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { parseTwd97String, twd97ToWgs84 } from "@/lib/geo";
import { fetchJson, ok, fail, pick, parseNum, unwrapRecords, safeIso } from "./util";

const NAME = "水利署 - 河川即時水位";

// Confirmed by the user against real responses (2026-07-19):
// - Real-time readings (WRA_WATER_LEVEL_URL) only carry stationid/waterlevel/
//   datetime — no alert level, name, or coordinates at all.
// - Station reference info (this resource) has the missing pieces: a real
//   station name (observatoryname), the three alert-level thresholds
//   (alertlevel1/2/3, empty string when a tier isn't defined for that
//   station), and TWD97 coordinates (locationbytwd97_xy) — but keyed by
//   "basinidentifier", which is confusingly the *station* code, and happens
//   to hold the exact same value as the real-time feed's "stationid".
function stationInfoUrl(): string {
  return (
    process.env.WRA_WATER_STATION_INFO_URL ??
    "https://opendata.wra.gov.tw/api/v2/c4acc691-7416-40ca-9464-292c0c00da92?format=JSON"
  );
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-flood-1",
      category: "flood",
      title: "高屏溪（大津）水位站 超過警戒水位（示範資料）",
      description: "水位 12.4 公尺，超過一級警戒",
      severity: "serious",
      county: "高雄市",
      location: countyCentroid("高雄市"),
      time: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

// Taiwan's river alert levels run 一級 (most severe) > 二級 > 三級 (first
// warning), i.e. the level-1 threshold is the *highest* water level —
// confirmed against a real station (alertlevel1 "5.8" > alertlevel2 "4.6").
// A tier that isn't defined for a given station comes back as "" (parseNum
// -> undefined) and is simply skipped rather than treated as 0.
export function severityFromLevels(
  waterLevel: number,
  level1?: number,
  level2?: number,
  level3?: number
): Severity | undefined {
  if (level1 !== undefined && waterLevel >= level1) return "critical";
  if (level2 !== undefined && waterLevel >= level2) return "serious";
  if (level3 !== undefined && waterLevel >= level3) return "warning";
  return undefined;
}

interface StationInfo {
  name: string;
  riverName?: string;
  level1?: number;
  level2?: number;
  level3?: number;
  lat?: number;
  lng?: number;
}

async function fetchStationInfoMap(): Promise<Map<string, StationInfo>> {
  const raw = await fetchJson<unknown>(stationInfoUrl());
  const map = new Map<string, StationInfo>();
  for (const r of unwrapRecords(raw)) {
    const stationId = String(pick(r, "basinidentifier", "stationid") ?? "");
    if (!stationId) continue;
    const point = parseTwd97String(pick(r, "locationbytwd97_xy"));
    const converted = point ? twd97ToWgs84(point.x, point.y) : undefined;
    map.set(stationId, {
      name: String(pick(r, "observatoryname", "stationname") ?? stationId),
      riverName: pick(r, "rivername") as string | undefined,
      level1: parseNum(pick(r, "alertlevel1")),
      level2: parseNum(pick(r, "alertlevel2")),
      level3: parseNum(pick(r, "alertlevel3")),
      lat: converted?.lat,
      lng: converted?.lng,
    });
  }
  return map;
}

// Untransformed upstream responses, for /api/debug — both the live readings
// and the station reference data that's joined against them, since neither
// one alone tells the whole story for this source.
export async function fetchFloodRaw(): Promise<unknown> {
  const url = process.env.WRA_WATER_LEVEL_URL;
  if (!url) throw new Error("WRA_WATER_LEVEL_URL not configured");
  const [realtime, stationInfo] = await Promise.all([
    fetchJson<unknown>(url),
    fetchJson<unknown>(stationInfoUrl()),
  ]);
  return { realtime, stationInfo };
}

export async function fetchFlood() {
  const url = process.env.WRA_WATER_LEVEL_URL;
  if (!url) {
    return ok("flood", NAME, demoData(), true);
  }
  try {
    const [raw, stationInfoMap] = await Promise.all([
      fetchJson<unknown>(url),
      fetchStationInfoMap(),
    ]);

    const events: PulseEvent[] = [];
    for (const r of unwrapRecords(raw)) {
      const stationId = String(pick(r, "stationid") ?? "");
      const waterLevel = parseNum(pick(r, "waterlevel"));
      if (!stationId || waterLevel === undefined) continue;
      // Without a matching station-info record there's no name, threshold,
      // or coordinate to work with — nothing usable to show for this
      // reading, so skip it rather than guess.
      const info = stationInfoMap.get(stationId);
      if (!info) continue;
      const severity = severityFromLevels(waterLevel, info.level1, info.level2, info.level3);
      if (!severity) continue; // below every known threshold for this station — normal, not newsworthy
      const time = pick(r, "datetime") as string | undefined;
      events.push({
        id: `flood-${stationId}-${time ?? Date.now()}`,
        category: "flood",
        title: `${info.name} 水位超過警戒`,
        description: `水位 ${waterLevel} 公尺${info.riverName ? `（${info.riverName}）` : ""}`,
        severity,
        location:
          info.lat !== undefined && info.lng !== undefined
            ? { lat: info.lat, lng: info.lng, name: info.name }
            : undefined,
        time: safeIso(time),
        source: NAME,
      });
    }
    return ok("flood", NAME, events, false);
  } catch (err) {
    return fail("flood", NAME, err, demoData());
  }
}

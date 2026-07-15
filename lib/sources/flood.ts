import { PulseEvent } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";

const NAME = "水利署 - 河川即時水位";

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

export async function fetchFlood() {
  const url = process.env.WRA_WATER_LEVEL_URL;
  if (!url) {
    return ok("flood", NAME, demoData(), true);
  }
  try {
    const raw = await fetchJson<unknown>(url);
    const records: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray((raw as { records?: unknown[] })?.records)
      ? ((raw as { records: Record<string, unknown>[] }).records)
      : [];

    const events: PulseEvent[] = [];
    for (const r of records) {
      const alertLevelRaw = pick(r, "AlertLevel", "alertlevel", "警戒") ;
      const alertLevel = Number(alertLevelRaw);
      if (!Number.isFinite(alertLevel) || alertLevel <= 0) continue; // only surface stations above normal
      const stationName = String(pick(r, "StationName", "stationname", "station_name") ?? "測站");
      const county = String(pick(r, "County", "county") ?? "");
      const waterLevel = pick(r, "WaterLevel", "waterlevel");
      const time = pick(r, "RecordTime", "recordtime", "ObsTime") as string | undefined;
      const lat = Number(pick(r, "Latitude", "latitude"));
      const lng = Number(pick(r, "Longitude", "longitude"));
      events.push({
        id: `flood-${stationName}-${time ?? Date.now()}`,
        category: "flood",
        title: `${stationName} 水位超過警戒`,
        description: waterLevel !== undefined ? `水位 ${waterLevel} 公尺` : undefined,
        severity: alertLevel >= 3 ? "critical" : alertLevel === 2 ? "serious" : "warning",
        county,
        location:
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng, name: stationName }
            : countyCentroid(county),
        time: safeIso(time),
        source: NAME,
      });
    }
    return ok("flood", NAME, events, false);
  } catch (err) {
    return fail("flood", NAME, err, demoData());
  }
}

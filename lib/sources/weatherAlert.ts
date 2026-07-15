import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, safeIso, safeIsoOrUndefined } from "./util";

const NAME = "中央氣象署 - 天氣特報";

interface CwaHazard {
  info?: { phenomena?: string; significance?: string };
  validTime?: { startTime?: string; endTime?: string };
}

interface CwaLocation {
  locationName: string;
  hazardConditions?: { hazards?: CwaHazard[] };
}

interface CwaWeatherAlertResponse {
  records?: { location?: CwaLocation[] };
}

function phenomenaToSeverity(phenomena: string): Severity {
  if (/(海嘯|強烈颱風|超大豪雨|土石流紅色)/.test(phenomena)) return "critical";
  if (/(颱風|豪雨|土石流|強風|低溫特報橙|海上颱風)/.test(phenomena)) return "serious";
  if (/(大雨|濃霧|強陣風|低溫)/.test(phenomena)) return "warning";
  return "info";
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-weather-1",
      category: "weather",
      title: "臺北市 大雨特報（示範資料）",
      description: "慎防雷擊及強陣風",
      severity: "warning",
      county: "臺北市",
      location: countyCentroid("臺北市"),
      time: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      source: NAME,
      isDemo: true,
    },
    {
      id: "demo-weather-2",
      category: "weather",
      title: "花蓮縣 豪雨特報（示範資料）",
      severity: "serious",
      county: "花蓮縣",
      location: countyCentroid("花蓮縣"),
      time: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      validUntil: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

// Untransformed upstream response, for /api/debug.
export async function fetchWeatherAlertRaw(): Promise<unknown> {
  const key = process.env.CWA_API_KEY;
  if (!key) throw new Error("CWA_API_KEY not configured");
  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization=${encodeURIComponent(
    key
  )}&format=JSON`;
  return fetchJson<unknown>(url);
}

export async function fetchWeatherAlerts() {
  const key = process.env.CWA_API_KEY;
  if (!key) {
    return ok("weather", NAME, demoData(), true);
  }
  try {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization=${encodeURIComponent(
      key
    )}&format=JSON`;
    const data = await fetchJson<CwaWeatherAlertResponse>(url);
    const locations = data.records?.location ?? [];
    const events: PulseEvent[] = [];
    for (const loc of locations) {
      const hazards = loc.hazardConditions?.hazards ?? [];
      for (const h of hazards) {
        const phenomena = h.info?.phenomena ?? "天氣特報";
        events.push({
          id: `weather-${loc.locationName}-${phenomena}-${h.validTime?.startTime ?? ""}`,
          category: "weather",
          title: `${loc.locationName} ${phenomena}特報`,
          description: h.info?.significance,
          severity: phenomenaToSeverity(phenomena),
          county: loc.locationName,
          location: countyCentroid(loc.locationName),
          time: safeIso(h.validTime?.startTime),
          validUntil: safeIsoOrUndefined(h.validTime?.endTime),
          source: NAME,
        });
      }
    }
    if (events.length === 0) return ok("weather", NAME, [], false);
    return ok("weather", NAME, events, false);
  } catch (err) {
    return fail("weather", NAME, err, demoData());
  }
}

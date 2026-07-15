import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";

const NAME = "環境部 - 空氣品質即時測站";

export function aqiToSeverity(aqi: number): Severity {
  if (aqi >= 200) return "critical";
  if (aqi >= 150) return "serious";
  if (aqi >= 100) return "warning";
  return "info";
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-air-1",
      category: "air",
      title: "高雄（前鎮）測站 AQI 158（示範資料）",
      description: "對敏感族群不健康",
      severity: "serious",
      county: "高雄市",
      location: countyCentroid("高雄市"),
      time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

interface MoenvResponse {
  records?: Record<string, unknown>[];
}

// Untransformed upstream response, for /api/debug.
export async function fetchAirQualityRaw(): Promise<unknown> {
  const key = process.env.MOENV_API_KEY;
  if (!key) throw new Error("MOENV_API_KEY not configured");
  const url = `https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=${encodeURIComponent(
    key
  )}&format=JSON&limit=200`;
  return fetchJson<unknown>(url);
}

export async function fetchAirQuality() {
  const key = process.env.MOENV_API_KEY;
  if (!key) {
    return ok("air", NAME, demoData(), true);
  }
  try {
    const url = `https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=${encodeURIComponent(
      key
    )}&format=JSON&limit=200`;
    const data = await fetchJson<MoenvResponse>(url);
    const records = data.records ?? [];
    const events: PulseEvent[] = [];
    for (const r of records) {
      const aqiRaw = pick(r, "aqi", "AQI");
      const aqi = typeof aqiRaw === "string" ? parseInt(aqiRaw, 10) : Number(aqiRaw);
      if (!Number.isFinite(aqi) || aqi < 100) continue; // only surface notable readings
      const siteName = String(pick(r, "sitename", "SiteName") ?? "測站");
      const county = String(pick(r, "county", "County") ?? "");
      const status = String(pick(r, "status", "Status") ?? "");
      const lat = Number(pick(r, "latitude", "Latitude"));
      const lng = Number(pick(r, "longitude", "Longitude"));
      const publishTime = pick(r, "publishtime", "PublishTime") as string | undefined;
      events.push({
        id: `air-${siteName}-${publishTime ?? Date.now()}`,
        category: "air",
        title: `${siteName}測站 AQI ${aqi}`,
        description: status || undefined,
        severity: aqiToSeverity(aqi),
        county,
        location:
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng, name: siteName }
            : countyCentroid(county),
        time: safeIso(publishTime ? `${publishTime.replace(" ", "T")}+08:00` : undefined),
        source: NAME,
      });
    }
    return ok("air", NAME, events, false);
  } catch (err) {
    return fail("air", NAME, err, demoData());
  }
}

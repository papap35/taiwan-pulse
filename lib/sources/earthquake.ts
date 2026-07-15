import { PulseEvent, Severity } from "@/lib/types";
import { fetchJson, ok, fail, safeIso } from "./util";

const NAME = "中央氣象署 - 顯著有感地震";

interface CwaEarthquakeRecord {
  EarthquakeNo: number;
  ReportContent?: string;
  Web?: string;
  EarthquakeInfo: {
    OriginTime: string;
    FocalDepth?: number;
    Epicenter?: {
      Location?: string;
      EpicenterLatitude?: number;
      EpicenterLongitude?: number;
    };
    EarthquakeMagnitude?: { MagnitudeType?: string; MagnitudeValue?: number };
  };
}

interface CwaEarthquakeResponse {
  records?: { Earthquake?: CwaEarthquakeRecord[] };
}

function magnitudeToSeverity(mag: number): Severity {
  if (mag >= 6.5) return "critical";
  if (mag >= 5.5) return "serious";
  if (mag >= 4.5) return "warning";
  return "info";
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-eq-1",
      category: "earthquake",
      title: "花蓮縣近海 規模 5.2 地震（示範資料）",
      description: "深度 15.0 公里，最大震度 4 級",
      severity: "warning",
      county: "花蓮縣",
      location: { lat: 23.9, lng: 121.65, name: "花蓮縣近海" },
      time: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

export async function fetchEarthquakes() {
  const key = process.env.CWA_API_KEY;
  if (!key) {
    return ok("earthquake", NAME, demoData(), true);
  }
  try {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${encodeURIComponent(
      key
    )}&format=JSON&limit=15`;
    const data = await fetchJson<CwaEarthquakeResponse>(url);
    const records = data.records?.Earthquake ?? [];
    const events: PulseEvent[] = records.map((r) => {
      const mag = r.EarthquakeInfo?.EarthquakeMagnitude?.MagnitudeValue ?? 0;
      const loc = r.EarthquakeInfo?.Epicenter;
      return {
        id: `eq-${r.EarthquakeNo}`,
        category: "earthquake",
        title: `${loc?.Location ?? "未知位置"} 規模 ${mag.toFixed(1)} 地震`,
        description: r.ReportContent,
        severity: magnitudeToSeverity(mag),
        location:
          loc?.EpicenterLatitude && loc?.EpicenterLongitude
            ? { lat: loc.EpicenterLatitude, lng: loc.EpicenterLongitude, name: loc.Location }
            : undefined,
        time: safeIso(
          r.EarthquakeInfo?.OriginTime
            ? `${r.EarthquakeInfo.OriginTime.replace(" ", "T")}+08:00`
            : undefined
        ),
        source: NAME,
        sourceUrl: r.Web,
      };
    });
    if (events.length === 0) return ok("earthquake", NAME, demoData(), true);
    return ok("earthquake", NAME, events, false);
  } catch (err) {
    return fail("earthquake", NAME, err, demoData());
  }
}

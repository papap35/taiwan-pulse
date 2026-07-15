import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";

const NAME = "TDX 運輸資料流通服務 - 國道事件";
const TOKEN_URL =
  "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
// Confirmed correct by the user against TDX's live API (2026-07-15):
// 高速公路道路事件資訊 = /v1/Traffic/RoadEvent/LiveEvent/Freeway — note this
// is under v1, and under "RoadEvent/LiveEvent", not "Road/Traffic/Incident"
// (both earlier guesses were wrong on both the version and the path shape).
const INCIDENT_URL =
  process.env.TDX_INCIDENT_URL ??
  "https://tdx.transportdata.tw/api/basic/v1/Traffic/RoadEvent/LiveEvent/Freeway?%24format=JSON";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TDX auth failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-traffic-1",
      category: "traffic",
      title: "國道1號 北向 37K 車禍事故（示範資料）",
      description: "占用內側車道，車流回堵約 3 公里",
      severity: "warning",
      county: "新竹縣",
      location: countyCentroid("新竹縣"),
      time: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

function severityFromDescription(desc: string): Severity {
  if (/(封閉|坍方|中斷)/.test(desc)) return "critical";
  if (/(事故|車禍|回堵)/.test(desc)) return "serious";
  return "info";
}

export async function fetchTraffic() {
  const clientId = process.env.TDX_CLIENT_ID;
  const clientSecret = process.env.TDX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return ok("traffic", NAME, demoData(), true);
  }
  try {
    const token = await getToken(clientId, clientSecret);
    const raw = await fetchJson<unknown>(INCIDENT_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // TDX commonly wraps results in an envelope object (e.g.
    // { RoadEvents: [...], UpdateTime: "...", ... }) rather than returning a
    // bare array — confirmed in production (a bare-array assumption threw
    // "(...).map is not a function"). Check several likely array keys.
    const records: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : (() => {
          const candidate = pick(
            raw as Record<string, unknown>,
            "RoadEvents",
            "roadevents",
            "RoadEventLiveEvents",
            "LiveEvent",
            "LiveEvents",
            "Data",
            "data"
          );
          return Array.isArray(candidate) ? (candidate as Record<string, unknown>[]) : [];
        })();
    const events: PulseEvent[] = records.map((r, idx) => {
      // TDX's "RoadEvent" family commonly nests location under a sub-object
      // (e.g. RoadEventLocation) rather than flat top-level fields — check
      // both shapes since the exact schema for this endpoint is still
      // unverified against a live response.
      const nestedLocation =
        (pick(r, "RoadEventLocation", "roadeventlocation") as Record<string, unknown>) ?? r;
      const road = String(
        pick(nestedLocation, "RoadName", "roadname") ?? pick(r, "RoadName", "roadname") ?? "國道"
      );
      const desc = String(
        pick(r, "Description", "description", "RoadEventDescription") ?? "交通事件"
      );
      const lat = Number(
        pick(nestedLocation, "PositionLat", "positionlat") ?? pick(r, "PositionLat", "positionlat")
      );
      const lng = Number(
        pick(nestedLocation, "PositionLon", "positionlon") ?? pick(r, "PositionLon", "positionlon")
      );
      const start = pick(
        r,
        "RoadEventStartTime",
        "roadeventstarttime",
        "EventStartTime",
        "eventstarttime",
        "PublishTime"
      ) as string | undefined;
      const id = pick(r, "RoadEventID", "roadeventid", "IncidentID", "incidentid");
      return {
        id: `traffic-${id ?? idx}`,
        category: "traffic",
        title: `${road} - ${desc}`,
        severity: severityFromDescription(desc),
        location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, name: road } : undefined,
        time: safeIso(start),
        source: NAME,
      };
    });
    return ok("traffic", NAME, events, false);
  } catch (err) {
    return fail("traffic", NAME, err, demoData());
  }
}

import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick } from "./util";

const NAME = "TDX 運輸資料流通服務 - 國道事件";
const TOKEN_URL =
  "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const INCIDENT_URL =
  process.env.TDX_INCIDENT_URL ??
  "https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Incident/Highway?%24format=JSON";

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
    const records = await fetchJson<Record<string, unknown>[]>(INCIDENT_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const events: PulseEvent[] = (records ?? []).map((r, idx) => {
      const road = String(pick(r, "RoadName", "roadname") ?? "國道");
      const desc = String(pick(r, "Description", "description") ?? "交通事件");
      const lat = Number(pick(r, "PositionLat", "positionlat"));
      const lng = Number(pick(r, "PositionLon", "positionlon"));
      const start = pick(r, "EventStartTime", "eventstarttime") as string | undefined;
      const id = pick(r, "IncidentID", "incidentid");
      return {
        id: `traffic-${id ?? idx}`,
        category: "traffic",
        title: `${road} - ${desc}`,
        severity: severityFromDescription(desc),
        location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, name: road } : undefined,
        time: start ? new Date(start).toISOString() : new Date().toISOString(),
        source: NAME,
      };
    });
    return ok("traffic", NAME, events, false);
  } catch (err) {
    return fail("traffic", NAME, err, demoData());
  }
}

import { PulseEvent, Severity } from "@/lib/types";
import { COUNTY_COORDS, countyCentroid } from "@/lib/counties";
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

export function severityFromDescription(desc: string): Severity {
  if (/(封閉|坍方|中斷|全部阻斷|完全阻斷)/.test(desc)) return "critical";
  if (/(事故|車禍|回堵|部分阻斷|阻斷)/.test(desc)) return "serious";
  return "info";
}

// TDX tags routine lane closures for construction/maintenance with their own
// EventTitle ("施工事件" etc.), separate from the Impact.Description text
// that drives severityFromDescription. Confirmed against a real record: a
// construction event reporting "部分阻斷交通" (partial blockage) is planned
// roadwork, not an accident — downgrading it one level keeps the map from
// equating scheduled maintenance with an actual crash. Full closures during
// construction still stay critical (severityFromDescription already returns
// critical for those, and this only ever downgrades "serious").
export function isRoutineConstruction(title: string): boolean {
  return /(施工|維修保養|定期養護)/.test(title);
}

export function findCounty(text: string): string | undefined {
  return Object.keys(COUNTY_COORDS).find((c) => text.includes(c));
}

// TDX's "Positions" field is a WKT string, e.g. "POINT(121.199345 24.833352)"
// (lng then lat) — confirmed against a real /RoadEvent/LiveEvent/Freeway
// record. The flat PositionLat/PositionLon fields this source originally
// guessed don't exist on this endpoint at all.
export function parseWktPoint(wkt: unknown): { lat: number; lng: number } | undefined {
  if (typeof wkt !== "string") return undefined;
  const match = /POINT\s*\(\s*([+-]?[\d.]+)\s+([+-]?[\d.]+)\s*\)/i.exec(wkt);
  if (!match) return undefined;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
}

// Untransformed upstream response, for /api/debug — lets us see exactly
// what TDX returns without guessing field names blind.
export async function fetchTrafficRaw(): Promise<unknown> {
  const clientId = process.env.TDX_CLIENT_ID;
  const clientSecret = process.env.TDX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TDX_CLIENT_ID / TDX_CLIENT_SECRET not configured");
  }
  const token = await getToken(clientId, clientSecret);
  return fetchJson<unknown>(INCIDENT_URL, { headers: { Authorization: `Bearer ${token}` } });
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
      // Confirmed real shape: the road name lives under
      // Location.FreeExpressHighway.Road (nested two levels), and impact
      // severity text lives under Impact.Description rather than the
      // top-level Description. Older guessed candidates are kept as
      // fallbacks in case a different RoadEvent sub-type (non-freeway) omits
      // FreeExpressHighway.
      const location = pick(r, "Location", "location") as Record<string, unknown> | undefined;
      const freeway = location
        ? (pick(location, "FreeExpressHighway", "freeexpresshighway") as
            | Record<string, unknown>
            | undefined)
        : undefined;
      const road = String(
        (freeway && pick(freeway, "Road", "road")) ??
          (location && pick(location, "RoadName", "roadname")) ??
          pick(r, "RoadName", "roadname") ??
          "國道"
      );
      const topDesc = String(pick(r, "Description", "description") ?? "");
      const impact = pick(r, "Impact", "impact") as Record<string, unknown> | undefined;
      const impactDesc = String(
        (impact && pick(impact, "Description", "description")) ?? ""
      );
      const desc = impactDesc || topDesc || "交通事件";
      const title = String(pick(r, "EventTitle", "eventtitle") ?? "");
      const point = parseWktPoint(pick(r, "Positions", "positions", "Position", "position"));
      const lat =
        point?.lat ??
        Number(pick(r, "PositionLat", "positionlat", "Latitude", "latitude"));
      const lng =
        point?.lng ??
        Number(pick(r, "PositionLon", "positionlon", "Longitude", "longitude"));
      const start = pick(
        r,
        "PublishTime",
        "publishtime",
        "EffectiveTime",
        "effectivetime",
        "RoadEventStartTime",
        "roadeventstarttime",
        "EventStartTime",
        "eventstarttime"
      ) as string | undefined;
      const id = pick(r, "EventID", "eventid", "RoadEventID", "roadeventid", "IncidentID", "incidentid");
      // Fall back to a county-level marker (parsed from the road name /
      // description text) rather than no marker at all when precise
      // coordinates can't be parsed — same pattern as fire.ts/security.ts.
      const county = findCounty(`${road} ${desc}`);
      const markerLocation =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng, name: road }
          : countyCentroid(county);
      let severity = severityFromDescription(desc);
      if (severity === "serious" && isRoutineConstruction(title)) severity = "warning";
      return {
        id: `traffic-${id ?? idx}`,
        category: "traffic",
        title: `${road} - ${title || desc}`,
        description: desc,
        severity,
        county,
        location: markerLocation,
        time: safeIso(start),
        source: NAME,
      };
    });
    return ok("traffic", NAME, events, false);
  } catch (err) {
    return fail("traffic", NAME, err, demoData());
  }
}

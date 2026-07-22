import { PulseEvent, Severity } from "@/lib/types";
import { COUNTY_COORDS, countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";
import { getTdxToken, hasTdxCredentials } from "./tdxAuth";

const NAME = "TDX 運輸資料流通服務 - 國道事件";
// Confirmed correct by the user against TDX's live API (2026-07-15):
// 高速公路道路事件資訊 = /v1/Traffic/RoadEvent/LiveEvent/Freeway — note this
// is under v1, and under "RoadEvent/LiveEvent", not "Road/Traffic/Incident"
// (both earlier guesses were wrong on both the version and the path shape).
const INCIDENT_URL =
  process.env.TDX_INCIDENT_URL ??
  "https://tdx.transportdata.tw/api/basic/v1/Traffic/RoadEvent/LiveEvent/Freeway?%24format=JSON";

function demoData(): PulseEvent[] {
  const location = countyCentroid("新竹縣")!;
  return [
    {
      id: "demo-traffic-1",
      category: "traffic",
      title: "國道1號 北向 37K 車禍事故（示範資料）",
      description: "占用內側車道，車流回堵約 3 公里",
      severity: "warning",
      county: "新竹縣",
      location,
      route: approximateRouteSegment(location, "北向"),
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

// Real road curvature isn't available without TDX's separate road-network
// GIS API (Map/Road/Network/... — deferred, see SPEC.md P2-6.5: joining it
// against StartKM/EndKM turned out to need another round of dataset
// research, similar in shape to the CDC epidemic rabbit hole, so this draws
// a short straight segment near the incident's point instead. Oriented
// along the highway's coarse compass heading from TDX's "Direction" field
// (北向/南向/東向/西向) — not a real traced road shape, just enough to read
// as "a stretch of road" instead of a bare point on the map.
const ROUTE_HALF_LENGTH_DEG = 0.003; // ~300-350m each side at Taiwan's latitude

export function approximateRouteSegment(
  point: { lat: number; lng: number },
  direction: string
): { lat: number; lng: number }[] {
  const isEastWest = /[東西]/.test(direction) && !/[北南]/.test(direction);
  if (isEastWest) {
    return [
      { lat: point.lat, lng: point.lng - ROUTE_HALF_LENGTH_DEG },
      { lat: point.lat, lng: point.lng + ROUTE_HALF_LENGTH_DEG },
    ];
  }
  // Default to north-south: covers 北向/南向 explicitly, and is a reasonable
  // fallback for anything else (雙向, 內側/外側, missing direction text) since
  // most Taiwan freeway mileage runs roughly north-south anyway.
  return [
    { lat: point.lat - ROUTE_HALF_LENGTH_DEG, lng: point.lng },
    { lat: point.lat + ROUTE_HALF_LENGTH_DEG, lng: point.lng },
  ];
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
  const token = await getTdxToken();
  return fetchJson<unknown>(INCIDENT_URL, { headers: { Authorization: `Bearer ${token}` } });
}

export async function fetchTraffic() {
  if (!hasTdxCredentials()) {
    return ok("traffic", NAME, demoData(), true);
  }
  try {
    const token = await getTdxToken();
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
      const direction = String(
        (freeway && pick(freeway, "Direction", "direction")) ?? ""
      );
      // Fall back to a county-level marker (parsed from the road name /
      // description text) rather than no marker at all when precise
      // coordinates can't be parsed — same pattern as fire.ts/security.ts.
      const county = findCounty(`${road} ${desc}`);
      const hasPrecisePoint = Number.isFinite(lat) && Number.isFinite(lng);
      const markerLocation = hasPrecisePoint
        ? { lat, lng, name: road }
        : countyCentroid(county);
      // Only draw the approximate segment against a genuine precise point —
      // a county-centroid fallback isn't a real road position, so a line
      // through it would misleadingly imply one.
      const route = hasPrecisePoint ? approximateRouteSegment({ lat, lng }, direction) : undefined;
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
        route,
        time: safeIso(start),
        source: NAME,
      };
    });
    return ok("traffic", NAME, events, false);
  } catch (err) {
    return fail("traffic", NAME, err, demoData());
  }
}

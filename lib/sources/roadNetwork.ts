import { fetchJson } from "./util";
import { getTdxToken, hasTdxCredentials } from "./tdxAuth";

// TDX's road-network GIS API — confirmed by the user against the real
// Swagger console (2026-07-21), tag "PhysicalNetwork":
//   GET /V3/Map/Road/Network/RoadClass/{RoadClass}/RoadName/{RoadName}
//     ?$top=N&$format=GEOJSON
// RoadClass 0 = national highway (國道); RoadName needs URL-encoding
// (e.g. "國道1號"). $top caps how many features come back — there's no
// "give me the whole road in one call" option the user found, so this is
// currently a bounded sample rather than full route coverage. This exists
// purely to let a real GeoJSON response get pasted back via /api/debug —
// no field parsing/joining against traffic.ts's StartKM/EndKM exists yet,
// see SPEC.md P2-6.5 for why (and what's still needed before it can).
const ROAD_NETWORK_BASE = "https://tdx.transportdata.tw/api/basic/V3/Map/Road/Network";

function roadNetworkUrl(roadName: string, top: number): string {
  return `${ROAD_NETWORK_BASE}/RoadClass/0/RoadName/${encodeURIComponent(roadName)}?%24top=${top}&%24format=GEOJSON`;
}

export async function fetchRoadNetworkRaw(
  roadName = "國道1號",
  top = 5
): Promise<unknown> {
  if (!hasTdxCredentials()) {
    throw new Error("TDX_CLIENT_ID / TDX_CLIENT_SECRET not configured");
  }
  const token = await getTdxToken();
  return fetchJson<unknown>(roadNetworkUrl(roadName, top), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

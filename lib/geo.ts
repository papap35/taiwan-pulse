// WRA's station reference datasets (e.g. river water level station info)
// publish coordinates in TWD97 TM2 (EPSG:3826) — a projected, meter-based
// system, not WGS84 lat/lng. Converting is required before these can be used
// as a map marker location. This is the standard inverse Transverse Mercator
// formula for Taiwan's national grid (GRS80 ellipsoid, central meridian
// 121°E, scale factor 0.9999, false easting 250000).
export function twd97ToWgs84(x: number, y: number): { lat: number; lng: number } {
  const a = 6378137.0;
  const b = 6356752.314245;
  const long0 = (121 * Math.PI) / 180;
  const k0 = 0.9999;
  const dx = 250000;

  const xAdj = x - dx;

  const e = Math.sqrt(1 - Math.pow(b / a, 2));
  const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
  const m = y / k0;

  const mu =
    m / (a * (1 - Math.pow(e, 2) / 4 - (3 * Math.pow(e, 4)) / 64 - (5 * Math.pow(e, 6)) / 256));
  const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));

  const j1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32;
  const j2 = (21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32;
  const j3 = (151 * Math.pow(e1, 3)) / 96;
  const j4 = (1097 * Math.pow(e1, 4)) / 512;

  const footpointLat =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);

  const c1 = e2 * Math.pow(Math.cos(footpointLat), 2);
  const t1 = Math.pow(Math.tan(footpointLat), 2);
  const r1 =
    (a * (1 - Math.pow(e, 2))) /
    Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(footpointLat), 2), 1.5);
  const n1 = a / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(footpointLat), 2), 0.5);

  const d = xAdj / (n1 * k0);

  const q1 = (n1 * Math.tan(footpointLat)) / r1;
  const q2 = Math.pow(d, 2) / 2;
  const q3 =
    ((5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * e2) * Math.pow(d, 4)) / 24;
  const q4 =
    ((61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 3 * Math.pow(c1, 2) - 252 * e2) *
      Math.pow(d, 6)) /
    720;
  const lat = footpointLat - q1 * (q2 - q3 + q4);

  const q6 = ((1 + 2 * t1 + c1) * Math.pow(d, 3)) / 6;
  const q7 =
    ((5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * e2 + 24 * Math.pow(t1, 2)) *
      Math.pow(d, 5)) /
    120;
  const lng = long0 + (d - q6 + q7) / Math.cos(footpointLat);

  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

// Parses WRA's "x y" space-separated coordinate string format (used for both
// locationbytwd97_xy and locationbytwd67_xy fields) into a TWD97 point.
export function parseTwd97String(value: unknown): { x: number; y: number } | undefined {
  if (typeof value !== "string") return undefined;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) return undefined;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

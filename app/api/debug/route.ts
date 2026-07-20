import { NextRequest, NextResponse } from "next/server";
import { fetchEarthquakeRaw } from "@/lib/sources/earthquake";
import { fetchWeatherAlertRaw } from "@/lib/sources/weatherAlert";
import { fetchAirQualityRaw } from "@/lib/sources/airQuality";
import { fetchTrafficRaw } from "@/lib/sources/traffic";
import { fetchFloodRaw } from "@/lib/sources/flood";
import { fetchReservoirRaw } from "@/lib/sources/reservoir";
import { fetchFireRaw } from "@/lib/sources/fire";
import { fetchSecurityRaw } from "@/lib/sources/security";
import { fetchSuspensionRaw } from "@/lib/sources/suspension";
import { fetchEpidemicRaw } from "@/lib/sources/epidemic";
import { fetchGridStatusRaw } from "@/lib/gridStatus";

// Diagnostic-only endpoint: returns each source's UNTRANSFORMED upstream
// response, exactly as the government API sent it, bypassing our own
// field-name parsing entirely. Since all fetching happens server-side (SSR),
// there's otherwise no way to see this from browser devtools — this exists
// specifically to unblock "what does the real API actually return" without
// needing to guess-and-check through repeated deploys.
//
// Not cached (force-dynamic): this is a manual, low-traffic diagnostic tool,
// not part of the app's normal request path, so it intentionally skips the
// ISR caching used by /api/events.
export const dynamic = "force-dynamic";
// epidemic's two-hop CKAN flow can take up to ~50s worst case (see
// lib/sources/epidemic.ts) — this is exactly the endpoint used to diagnose
// that kind of issue, so it needs the same headroom as the real routes.
export const maxDuration = 60;

const SOURCES: Record<string, () => Promise<unknown>> = {
  earthquake: fetchEarthquakeRaw,
  weather: fetchWeatherAlertRaw,
  air: fetchAirQualityRaw,
  traffic: fetchTrafficRaw,
  flood: fetchFloodRaw,
  reservoir: fetchReservoirRaw,
  fire: fetchFireRaw,
  security: fetchSecurityRaw,
  suspension: fetchSuspensionRaw,
  epidemic: fetchEpidemicRaw,
  gridStatus: fetchGridStatusRaw,
};

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");

  if (!source) {
    return NextResponse.json({
      usage: "/api/debug?source=<name>",
      availableSources: Object.keys(SOURCES),
    });
  }

  const fetcher = SOURCES[source];
  if (!fetcher) {
    return NextResponse.json(
      { error: `unknown source "${source}"`, availableSources: Object.keys(SOURCES) },
      { status: 400 }
    );
  }

  try {
    const raw = await fetcher();
    return NextResponse.json({ source, raw });
  } catch (err) {
    return NextResponse.json(
      { source, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

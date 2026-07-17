import { Category, PulseEvent, SourceStatus } from "@/lib/types";
import { fetchEarthquakes } from "@/lib/sources/earthquake";
import { fetchWeatherAlerts } from "@/lib/sources/weatherAlert";
import { fetchAirQuality } from "@/lib/sources/airQuality";
import { fetchTraffic } from "@/lib/sources/traffic";
import { fetchFlood } from "@/lib/sources/flood";
import { fetchReservoirLevels } from "@/lib/sources/reservoir";
import { fetchFireEvents } from "@/lib/sources/fire";
import { fetchSecurityEvents } from "@/lib/sources/security";
import { fetchSuspension } from "@/lib/sources/suspension";
import { fetchEpidemic } from "@/lib/sources/epidemic";

type SourceFetcher = () => Promise<{ events: PulseEvent[]; status: SourceStatus }>;

// One category can be backed by more than one fetcher (flood + reservoir
// both report under the "flood" category — see SPEC.md P1-3). Single source
// of truth for "which fetchers make up this category", shared by the
// combined /api/events aggregate and the per-category /api/events/[category]
// route so the two can't drift out of sync.
export const CATEGORY_SOURCES: Record<Category, SourceFetcher[]> = {
  earthquake: [fetchEarthquakes],
  weather: [fetchWeatherAlerts],
  air: [fetchAirQuality],
  traffic: [fetchTraffic],
  flood: [fetchFlood, fetchReservoirLevels],
  fire: [fetchFireEvents],
  security: [fetchSecurityEvents],
  suspension: [fetchSuspension],
  epidemic: [fetchEpidemic],
};

export async function fetchCategory(
  category: Category
): Promise<{ events: PulseEvent[]; sources: SourceStatus[] }> {
  const results = await Promise.allSettled(CATEGORY_SOURCES[category].map((f) => f()));
  const events: PulseEvent[] = [];
  const sources: SourceStatus[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      events.push(...r.value.events);
      sources.push(r.value.status);
    }
  }
  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return { events, sources };
}

import { EventsResponse } from "@/lib/types";
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
import { fetchGridStatus } from "@/lib/gridStatus";

export async function aggregateEvents(): Promise<EventsResponse> {
  const [results, gridStatus] = await Promise.all([
    Promise.allSettled([
      fetchEarthquakes(),
      fetchWeatherAlerts(),
      fetchAirQuality(),
      fetchTraffic(),
      fetchFlood(),
      fetchReservoirLevels(),
      fetchFireEvents(),
      fetchSecurityEvents(),
      fetchSuspension(),
      fetchEpidemic(),
    ]),
    fetchGridStatus(),
  ]);

  const events: EventsResponse["events"] = [];
  const sources: EventsResponse["sources"] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      events.push(...r.value.events);
      sources.push(r.value.status);
    }
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return {
    events,
    sources,
    gridStatus,
    generatedAt: new Date().toISOString(),
  };
}

import { EventsResponse } from "@/lib/types";
import { fetchEarthquakes } from "@/lib/sources/earthquake";
import { fetchWeatherAlerts } from "@/lib/sources/weatherAlert";
import { fetchAirQuality } from "@/lib/sources/airQuality";
import { fetchTraffic } from "@/lib/sources/traffic";
import { fetchFlood } from "@/lib/sources/flood";
import { fetchFireEvents } from "@/lib/sources/fire";
import { fetchSecurityEvents } from "@/lib/sources/security";

export async function aggregateEvents(): Promise<EventsResponse> {
  const results = await Promise.allSettled([
    fetchEarthquakes(),
    fetchWeatherAlerts(),
    fetchAirQuality(),
    fetchTraffic(),
    fetchFlood(),
    fetchFireEvents(),
    fetchSecurityEvents(),
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
    generatedAt: new Date().toISOString(),
  };
}

import { CATEGORY_ORDER, EventsResponse } from "@/lib/types";
import { fetchCategory } from "@/lib/sourceRegistry";
import { fetchGridStatus } from "@/lib/gridStatus";

export async function aggregateEvents(): Promise<EventsResponse> {
  const [perCategory, gridStatus] = await Promise.all([
    Promise.all(CATEGORY_ORDER.map((c) => fetchCategory(c))),
    fetchGridStatus(),
  ]);

  const events: EventsResponse["events"] = [];
  const sources: EventsResponse["sources"] = [];
  for (const result of perCategory) {
    events.push(...result.events);
    sources.push(...result.sources);
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return {
    events,
    sources,
    gridStatus,
    generatedAt: new Date().toISOString(),
  };
}

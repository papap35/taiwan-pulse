"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { CATEGORY_ORDER, Category, EventsResponse, PulseEvent } from "@/lib/types";
import Header from "./Header";
import CategoryBar from "./CategoryBar";
import EventList from "./EventList";
import Legend from "./Legend";
import SourceStatusFooter from "./SourceStatusFooter";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-ink-secondary-light dark:text-ink-secondary-dark">
      地圖載入中…
    </div>
  ),
});

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const REFRESH_MS = Number(process.env.NEXT_PUBLIC_REFRESH_MS ?? 120000);

export default function Dashboard() {
  const { data, isLoading, mutate } = useSWR<EventsResponse>("/api/events", fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: true,
  });

  const [active, setActive] = useState<Set<Category>>(new Set(CATEGORY_ORDER));
  const [selected, setSelected] = useState<PulseEvent | null>(null);

  const events = useMemo(() => data?.events ?? [], [data]);
  const filtered = useMemo(
    () => events.filter((e) => active.has(e.category)),
    [events, active]
  );

  function toggleCategory(c: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  return (
    <div className="flex h-screen flex-col bg-page-light dark:bg-page-dark">
      <Header generatedAt={data?.generatedAt} loading={isLoading} onRefresh={() => mutate()} />
      <CategoryBar events={events} active={active} onToggle={toggleCategory} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-[320px] flex-1 md:min-h-0">
          <MapView events={filtered} selected={selected} onSelect={setSelected} />
        </div>
        <div className="min-h-0 w-full border-t border-gridline-light bg-surface-light dark:border-gridline-dark dark:bg-surface-dark md:w-[380px] md:border-l md:border-t-0 lg:w-[440px]">
          <EventList events={filtered} selected={selected} onSelect={setSelected} />
        </div>
      </div>
      <Legend />
      <SourceStatusFooter sources={data?.sources ?? []} />
    </div>
  );
}

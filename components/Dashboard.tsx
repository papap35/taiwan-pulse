"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import useSWR, { mutate as globalMutate } from "swr";
import { CATEGORY_ORDER, Category, GridStatus, PulseEvent, SourceStatus } from "@/lib/types";
import Header from "./Header";
import CategoryBar from "./CategoryBar";
import EventList from "./EventList";
import Legend from "./Legend";
import SourceStatusFooter from "./SourceStatusFooter";
import GridStatusBanner from "./GridStatusBanner";

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

interface CategoryEventsResponse {
  events: PulseEvent[];
  sources: SourceStatus[];
}

// One useSWR call per category, isolated inside its own component instance
// (never inside a loop/callback in Dashboard itself, which would break the
// Rules of Hooks) so each category has its own cache entry and revalidation
// timer. This is what lets fast sources (earthquake, weather) paint before
// slow ones (traffic, which needs a TDX OAuth round-trip) instead of the
// whole dashboard waiting on a single combined /api/events response.
function CategorySource({
  category,
  onUpdate,
}: {
  category: Category;
  onUpdate: (category: Category, data: CategoryEventsResponse) => void;
}) {
  const { data } = useSWR<CategoryEventsResponse>(`/api/events/${category}`, fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: true,
  });

  useEffect(() => {
    if (data) onUpdate(category, data);
  }, [category, data, onUpdate]);

  return null;
}

export default function Dashboard() {
  const [byCategory, setByCategory] = useState<Partial<Record<Category, CategoryEventsResponse>>>(
    {}
  );
  const handleUpdate = useCallback((category: Category, data: CategoryEventsResponse) => {
    setByCategory((prev) => ({ ...prev, [category]: data }));
  }, []);

  const { data: gridData, isLoading: gridLoading } = useSWR<{ gridStatus: GridStatus }>(
    "/api/grid-status",
    fetcher,
    { refreshInterval: REFRESH_MS, revalidateOnFocus: true }
  );

  const [active, setActive] = useState<Set<Category>>(new Set(CATEGORY_ORDER));
  const [selected, setSelected] = useState<PulseEvent | null>(null);

  const events = useMemo(() => {
    const all: PulseEvent[] = [];
    for (const c of CATEGORY_ORDER) all.push(...(byCategory[c]?.events ?? []));
    all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return all;
  }, [byCategory]);

  const sources = useMemo(() => {
    const all: SourceStatus[] = [];
    for (const c of CATEGORY_ORDER) all.push(...(byCategory[c]?.sources ?? []));
    return all;
  }, [byCategory]);

  const generatedAt = useMemo(() => {
    let latest: string | undefined;
    for (const s of sources) {
      if (!latest || new Date(s.fetchedAt).getTime() > new Date(latest).getTime()) {
        latest = s.fetchedAt;
      }
    }
    return latest;
  }, [sources]);

  const filtered = useMemo(
    () => events.filter((e) => active.has(e.category)),
    [events, active]
  );

  const stillLoading =
    gridLoading || CATEGORY_ORDER.some((c) => byCategory[c] === undefined);

  function toggleCategory(c: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function refreshAll() {
    globalMutate("/api/grid-status");
    for (const c of CATEGORY_ORDER) globalMutate(`/api/events/${c}`);
  }

  return (
    <div className="flex h-screen flex-col bg-page-light dark:bg-page-dark">
      {CATEGORY_ORDER.map((c) => (
        <CategorySource key={c} category={c} onUpdate={handleUpdate} />
      ))}
      <Header generatedAt={generatedAt} loading={stillLoading} onRefresh={refreshAll} />
      <GridStatusBanner status={gridData?.gridStatus} />
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
      <SourceStatusFooter sources={sources} />
    </div>
  );
}

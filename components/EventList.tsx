import { PulseEvent } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { relativeTime, formatClock } from "@/lib/time";
import CategoryDot from "./CategoryDot";
import SeverityBadge from "./SeverityBadge";

export default function EventList({
  events,
  selected,
  onSelect,
}: {
  events: PulseEvent[];
  selected: PulseEvent | null;
  onSelect: (e: PulseEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-ink-secondary-light dark:text-ink-secondary-dark">
        目前沒有符合篩選條件的事件
      </div>
    );
  }

  return (
    <ul className="h-full divide-y divide-gridline-light overflow-y-auto dark:divide-gridline-dark">
      {events.map((e) => (
        <li key={e.id}>
          <button
            onClick={() => onSelect(e)}
            className={`w-full px-4 py-3 text-left transition hover:bg-gridline-light/30 dark:hover:bg-gridline-dark/30 sm:px-6 ${
              selected?.id === e.id ? "bg-gridline-light/50 dark:bg-gridline-dark/50" : ""
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-ink-secondary-light dark:text-ink-secondary-dark">
              <CategoryDot category={e.category} />
              <span>{CATEGORY_LABELS[e.category]}</span>
              <span aria-hidden>・</span>
              <span title={formatClock(e.time)}>{relativeTime(e.time)}</span>
              {e.county && (
                <>
                  <span aria-hidden>・</span>
                  <span>{e.county}</span>
                </>
              )}
            </div>
            <div className="mt-1 font-medium leading-snug">{e.title}</div>
            {e.description && (
              <div className="mt-0.5 text-sm text-ink-secondary-light dark:text-ink-secondary-dark line-clamp-2">
                {e.description}
              </div>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <SeverityBadge severity={e.severity} />
              <span className="text-xs text-ink-muted">
                {e.source}
                {e.isDemo && " ・ 示範資料"}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

import { CATEGORY_LABELS, CATEGORY_ORDER, Category, PulseEvent } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/style";
import CategoryDot from "./CategoryDot";

export default function CategoryBar({
  events,
  active,
  onToggle,
}: {
  events: PulseEvent[];
  active: Set<Category>;
  onToggle: (c: Category) => void;
}) {
  const counts = new Map<Category, number>();
  for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-6" role="group" aria-label="事件類別篩選">
      {CATEGORY_ORDER.map((c) => {
        const isActive = active.has(c);
        const count = counts.get(c) ?? 0;
        return (
          <button
            key={c}
            onClick={() => onToggle(c)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              isActive
                ? "border-ink-primary-light/30 bg-surface-light shadow-sm dark:border-ink-primary-dark/30 dark:bg-surface-dark"
                : "border-gridline-light bg-transparent opacity-50 dark:border-gridline-dark"
            }`}
            style={isActive ? { boxShadow: `inset 0 0 0 1px ${CATEGORY_COLORS[c]}33` } : undefined}
          >
            <CategoryDot category={c} />
            <span className="font-medium">{CATEGORY_LABELS[c]}</span>
            <span className="tabular-nums text-ink-secondary-light dark:text-ink-secondary-dark">
              {count}
            </span>
            {isActive && <span aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

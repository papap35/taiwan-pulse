import { GridStatus } from "@/lib/types";
import { GRID_STATUS_COLORS, GRID_STATUS_ICON } from "@/lib/style";
import { relativeTime } from "@/lib/time";

export default function GridStatusBanner({ status }: { status?: GridStatus }) {
  if (!status) return null;
  const color = GRID_STATUS_COLORS[status.level];

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-gridline-light px-4 py-2 text-sm dark:border-gridline-dark sm:px-6"
      style={{ backgroundColor: `${color}14` }}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <span aria-hidden>{GRID_STATUS_ICON[status.level]}</span>
        {status.label}
      </span>
      <span className="font-medium">全國電力供需</span>
      {status.detail && (
        <span className="text-ink-secondary-light dark:text-ink-secondary-dark">
          {status.detail}
        </span>
      )}
      <span className="text-xs text-ink-muted">
        {status.source} ・ {relativeTime(status.updatedAt)}
        {status.isDemo && " ・ 示範資料"}
      </span>
    </div>
  );
}

import { Category, SourceStatus } from "@/lib/types";
import { relativeTime } from "@/lib/time";

// Maps a source's category to its /api/debug?source=<key> key (see
// app/api/debug/route.ts's SOURCES map). Almost 1:1 with Category, except
// "flood" covers two distinct debug sources (river water level + reservoir,
// see lib/sourceRegistry.ts) — disambiguated by name below since there's no
// separate field carrying this on SourceStatus itself.
const CATEGORY_DEBUG_KEY: Partial<Record<Category, string>> = {
  earthquake: "earthquake",
  weather: "weather",
  air: "air",
  traffic: "traffic",
  fire: "fire",
  security: "security",
  suspension: "suspension",
  epidemic: "epidemic",
};

function debugKeyFor(status: SourceStatus): string {
  if (status.category === "flood") {
    return status.name.includes("水庫") ? "reservoir" : "flood";
  }
  return CATEGORY_DEBUG_KEY[status.category] ?? status.category;
}

export default function SourceStatusFooter({ sources }: { sources: SourceStatus[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="border-t border-gridline-light px-4 py-2 text-xs text-ink-secondary-light dark:border-gridline-dark dark:text-ink-secondary-dark sm:px-6">
      <summary className="cursor-pointer font-medium">資料來源狀態（{sources.length}）</summary>
      <ul className="mt-2 space-y-1">
        {sources.map((s) => (
          <li key={s.name} className="flex flex-wrap items-center gap-2">
            <span aria-hidden>{s.ok ? "✅" : "⚠️"}</span>
            <span className="font-medium">{s.name}</span>
            <span>{s.ok ? "正常" : "取用失敗"}</span>
            {s.isDemo && <span className="rounded bg-status-warning/20 px-1.5 py-0.5 text-status-warning">示範資料</span>}
            <span>{s.count} 筆</span>
            <span>更新於 {relativeTime(s.fetchedAt)}</span>
            {s.error && <span className="text-status-critical">錯誤：{s.error}</span>}
            <a
              href={`/api/debug?source=${debugKeyFor(s)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-ink-primary-light dark:hover:text-ink-primary-dark"
            >
              查看原始回應
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

import { SourceStatus } from "@/lib/types";
import { relativeTime } from "@/lib/time";

export default function SourceStatusFooter({ sources }: { sources: SourceStatus[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="border-t border-gridline-light px-4 py-2 text-xs text-ink-secondary-light dark:border-gridline-dark dark:text-ink-secondary-dark sm:px-6">
      <summary className="cursor-pointer font-medium">資料來源狀態（{sources.length}）</summary>
      <ul className="mt-2 space-y-1">
        {sources.map((s) => (
          <li key={s.category} className="flex flex-wrap items-center gap-2">
            <span aria-hidden>{s.ok ? "✅" : "⚠️"}</span>
            <span className="font-medium">{s.name}</span>
            <span>{s.ok ? "正常" : "取用失敗"}</span>
            {s.isDemo && <span className="rounded bg-status-warning/20 px-1.5 py-0.5 text-status-warning">示範資料</span>}
            <span>{s.count} 筆</span>
            <span>更新於 {relativeTime(s.fetchedAt)}</span>
            {s.error && <span className="text-status-critical">錯誤：{s.error}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

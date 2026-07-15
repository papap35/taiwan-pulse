import { relativeTime } from "@/lib/time";

export default function Header({
  generatedAt,
  loading,
  onRefresh,
}: {
  generatedAt?: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gridline-light px-4 py-3 dark:border-gridline-dark sm:px-6">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl">Taiwan Pulse 台灣即時監控</h1>
        <p className="text-sm text-ink-secondary-light dark:text-ink-secondary-dark">
          地震・天氣特報・空氣品質・交通・水利淹水・火災・治安快訊・停班停課
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-secondary-light dark:text-ink-secondary-dark">
        {generatedAt && <span>資料更新：{relativeTime(generatedAt)}</span>}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-md border border-gridline-light px-3 py-1.5 font-medium text-ink-primary-light hover:bg-gridline-light/40 disabled:opacity-50 dark:border-gridline-dark dark:text-ink-primary-dark dark:hover:bg-gridline-dark/40"
        >
          {loading ? "更新中…" : "立即更新"}
        </button>
      </div>
    </header>
  );
}

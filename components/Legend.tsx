import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";
import CategoryDot from "./CategoryDot";

export default function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gridline-light px-4 py-2 text-xs text-ink-secondary-light dark:border-gridline-dark dark:text-ink-secondary-dark sm:px-6">
      <span className="font-medium">圖例：</span>
      {CATEGORY_ORDER.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <CategoryDot category={c} size={8} />
          {CATEGORY_LABELS[c]}
        </span>
      ))}
      <span className="ml-2">圓圈外框顏色代表嚴重程度（灰／黃／橘／紅）</span>
    </div>
  );
}

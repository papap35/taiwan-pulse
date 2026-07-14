import { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/style";

export default function CategoryDot({ category, size = 10 }: { category: Category; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full shrink-0"
      style={{ backgroundColor: CATEGORY_COLORS[category], width: size, height: size }}
    />
  );
}

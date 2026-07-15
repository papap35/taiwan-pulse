import { Category } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_SHAPE } from "@/lib/style";

export default function CategoryDot({ category, size = 10 }: { category: Category; size?: number }) {
  const isSquare = CATEGORY_SHAPE[category] === "square";
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${isSquare ? "rounded-[2px]" : "rounded-full"}`}
      style={{ backgroundColor: CATEGORY_COLORS[category], width: size, height: size }}
    />
  );
}

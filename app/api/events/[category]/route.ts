import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_SOURCES, fetchCategory } from "@/lib/sourceRegistry";
import { CATEGORY_ORDER, Category } from "@/lib/types";

// Same ISR window as the combined /api/events aggregate — each category's
// upstream fetches already carry their own Next Data Cache entry
// (REVALIDATE_SECONDS in lib/sources/util.ts), so splitting the route
// doesn't change how often the government APIs actually get hit.
export const revalidate = 120;

// All 9 categories are known at build time, so pre-generate a static param
// for each one instead of leaving this a fully dynamic route handler — keeps
// this route ISR-cached the same way /api/events is, rather than every
// request being server-rendered on demand.
export function generateStaticParams() {
  return CATEGORY_ORDER.map((category) => ({ category }));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;
  if (!(category in CATEGORY_SOURCES)) {
    return NextResponse.json(
      { error: `unknown category: ${category}`, availableCategories: Object.keys(CATEGORY_SOURCES) },
      { status: 404 }
    );
  }
  const { events, sources } = await fetchCategory(category as Category);
  return NextResponse.json({ events, sources });
}

import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_SOURCES, fetchCategory } from "@/lib/sourceRegistry";
import { CATEGORY_ORDER, Category } from "@/lib/types";

// See app/api/events/route.ts for why — same reasoning applies per-category.
export const preferredRegion = "hnd1";

// Same ISR window as the combined /api/events aggregate — each category's
// upstream fetches already carry their own Next Data Cache entry
// (REVALIDATE_SECONDS in lib/sources/util.ts), so splitting the route
// doesn't change how often the government APIs actually get hit.
export const revalidate = 120;

// Several sources fetch large files or chain multiple calls (e.g. flood.ts's
// realtime+station-info join, epidemic.ts's two parallel multi-MB JSON
// files, see lib/sources/epidemic.ts). Raising this has no effect on plans
// that cap it lower, and no downside on plans that honor it.
export const maxDuration = 60;

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

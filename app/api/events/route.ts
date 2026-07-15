import { NextResponse } from "next/server";
import { aggregateEvents } from "@/lib/aggregate";

// ISR-style caching for this route: Next.js serves the cached JSON for up to
// `revalidate` seconds, then revalidates in the background on the next
// request (stale-while-revalidate) instead of every client poll hitting the
// upstream government APIs directly.
export const revalidate = 120;

export async function GET() {
  const data = await aggregateEvents();
  return NextResponse.json(data);
}

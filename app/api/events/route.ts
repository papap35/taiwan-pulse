import { NextResponse } from "next/server";
import { aggregateEvents } from "@/lib/aggregate";

// ISR-style caching for this route: Next.js serves the cached JSON for up to
// `revalidate` seconds, then revalidates in the background on the next
// request (stale-while-revalidate) instead of every client poll hitting the
// upstream government APIs directly.
export const revalidate = 120;

// The default serverless function duration is too short for a cold-cache
// run of every source in sequence-ish (Promise.allSettled still bounds it
// by the slowest single source) — epidemic.ts's two-hop CKAN flow alone can
// take up to ~50s worst case (2 calls x 25s timeout each). Raising this has
// no effect on plans that cap it lower, and no downside on plans that honor
// it.
export const maxDuration = 60;

export async function GET() {
  const data = await aggregateEvents();
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { aggregateEvents } from "@/lib/aggregate";

// Every source here calls out to a .gov.tw domain. Confirmed against a real
// error (2026-07-23): CDC's od.cdc.gov.tw failed with UND_ERR_CONNECT_TIMEOUT
// — the TCP handshake itself never completed within 10s, which is a
// network-layer symptom (packets dropped), not a slow server. Vercel's
// default function region is US-based (iad1) absent this setting; many
// Taiwan government sites are known to firewall non-Taiwan/foreign-cloud
// source IPs, which fits this signature. hnd1 (Tokyo) is the closest region
// Vercel offers to Taiwan. This is a genuinely different lever than the
// four earlier CDC fixes (retry/timeout/maxDuration/User-Agent), which were
// all application-layer and couldn't have touched a connect-level block.
export const preferredRegion = "hnd1";

// ISR-style caching for this route: Next.js serves the cached JSON for up to
// `revalidate` seconds, then revalidates in the background on the next
// request (stale-while-revalidate) instead of every client poll hitting the
// upstream government APIs directly.
export const revalidate = 120;

// The default serverless function duration is too short for a cold-cache
// run of every source in sequence-ish (Promise.allSettled still bounds it
// by the slowest single source) — several sources fetch large files or
// chain multiple calls (e.g. flood.ts's realtime+station-info join,
// epidemic.ts's two parallel multi-MB JSON files). Raising this has no
// effect on plans that cap it lower, and no downside on plans that honor it.
export const maxDuration = 60;

export async function GET() {
  const data = await aggregateEvents();
  return NextResponse.json(data);
}

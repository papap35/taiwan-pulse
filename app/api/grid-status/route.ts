import { NextResponse } from "next/server";
import { fetchGridStatus } from "@/lib/gridStatus";

// See app/api/events/route.ts for why.
export const preferredRegion = "hnd1";

// Split out from the combined /api/events aggregate so the frontend can load
// the grid banner independently of the 9 event categories — see
// SPEC.md "漸進式載入" for why.
export const revalidate = 120;

export async function GET() {
  const gridStatus = await fetchGridStatus();
  return NextResponse.json({ gridStatus });
}

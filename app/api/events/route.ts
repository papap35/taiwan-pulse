import { NextResponse } from "next/server";
import { aggregateEvents } from "@/lib/aggregate";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await aggregateEvents();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

import { PulseEvent, SourceStatus, Category } from "@/lib/types";

// Must match app/api/events/route.ts's `revalidate` export. Kept as one
// constant instead of two separately-maintained numbers.
//
// This is NOT just a performance tweak: `cache: "no-store"` tells Next.js
// "this fetch must never be cached," and per Next's documented behavior,
// any such fetch reached during rendering opts the *entire route* out of
// static generation into full per-request dynamic rendering — silently
// overriding `export const revalidate` the moment a source actually calls
// out to a real API (confirmed empirically: a route with every source
// gated behind an unset env var stayed static+ISR at build time; making
// just one source's fetch unconditional flipped the whole route to
// dynamic). Using Next's own fetch cache (`next: { revalidate }`) instead
// keeps each upstream call individually cached and revalidated, which is
// what actually lets the route stay statically rendered with ISR.
export const REVALIDATE_SECONDS = 120;

// Gateway-level errors (502/503/504) are usually transient — an upstream
// government API momentarily overloaded or mid-deploy — unlike 404/401/etc,
// which mean "this request is wrong" and retrying changes nothing. Confirmed
// against a real production report: WRA's water level and reservoir
// endpoints returned HTTP 503 (see SPEC.md P0-1), which a bare fetch treats
// the same as a permanent failure and immediately falls back to demo data.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_BACKOFF_MS = [500, 1500];

async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.ok || !RETRYABLE_STATUS.has(res.status)) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    } catch (err) {
      // A thrown error here means the request never got an HTTP response at
      // all — a timeout (our own AbortController firing), DNS failure, or
      // connection drop. Retrying with the same timeout budget doesn't fix
      // "the server didn't respond in time," it just multiplies the wait
      // (confirmed in production: a slow CKAN search compounded across
      // retries until something upstream aborted the whole request first).
      // Only HTTP-status-based retries above are safe to compound; fail
      // fast here instead.
      clearTimeout(timer);
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < RETRY_BACKOFF_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS[attempt]));
    }
  }
  throw lastError;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<T> {
  const res = await fetchWithRetry(url, init, timeoutMs);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const res = await fetchWithRetry(url, undefined, timeoutMs);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return await res.text();
}

// Case-insensitive field lookup: several Taiwan open-data feeds vary field
// casing between releases (e.g. "AQI" vs "aqi").
export function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    if (lower[k.toLowerCase()] !== undefined) return lower[k.toLowerCase()];
  }
  return undefined;
}

// External date fields are never trustworthy — format drift, empty strings,
// or a field rename can all produce an unparseable Date. new Date(x) doesn't
// throw on its own, but .toISOString() on an Invalid Date does (RangeError:
// Invalid time value), which — uncaught inside a per-record loop — has taken
// down entire real-data batches in production, discarding otherwise-good
// records for one bad date. Always go through this instead of
// `new Date(x).toISOString()` directly.
export function safeIso(value: string | undefined | null): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Same idea, for optional fields (e.g. validUntil) where "unknown" should
// stay absent rather than default to "now".
export function safeIsoOrUndefined(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Government open-data feeds often represent "no value" as an empty string
// rather than omitting the field (confirmed on WRA's real station-info
// response: alertlevel3 was "" for a station with no third-tier threshold).
// Number("") is 0, not NaN, so a bare Number()/parseFloat() call here would
// silently treat "not set" as "the threshold is zero" — always returns
// undefined instead of a false zero for anything that isn't a real number.
export function parseNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// WRA's opendata.wra.gov.tw/api/v2/{resource-id} endpoints are CKAN-like:
// the array of records may come back bare, under "records", or nested under
// "result.records" depending on which resource this is (confirmed against
// real responses across three different resources so far — see SPEC.md
// P0-1). Centralized here instead of duplicated per source.
export function unwrapRecords(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const direct = (raw as { records?: unknown })?.records;
  if (Array.isArray(direct)) return direct as Record<string, unknown>[];
  const nested = (raw as { result?: { records?: unknown } })?.result?.records;
  if (Array.isArray(nested)) return nested as Record<string, unknown>[];
  return [];
}

export function ok(
  category: Category,
  name: string,
  events: PulseEvent[],
  isDemo = false
): { events: PulseEvent[]; status: SourceStatus } {
  return {
    events,
    status: {
      category,
      name,
      ok: true,
      isDemo,
      count: events.length,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export function fail(
  category: Category,
  name: string,
  error: unknown,
  fallback: PulseEvent[]
): { events: PulseEvent[]; status: SourceStatus } {
  return {
    events: fallback,
    status: {
      category,
      name,
      ok: false,
      isDemo: true,
      error: error instanceof Error ? error.message : String(error),
      count: fallback.length,
      fetchedAt: new Date().toISOString(),
    },
  };
}

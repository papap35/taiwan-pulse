import { PulseEvent, SourceStatus, Category } from "@/lib/types";

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
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

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

import { GridStatus, GridStatusLevel } from "@/lib/types";
import { fetchJson, pick, safeIso } from "@/lib/sources/util";

const NAME = "台灣電力公司 - 電力供需即時燈號";

function demoStatus(): GridStatus {
  return {
    level: "warning",
    label: "供電吃緊",
    detail: "備轉容量率 6.8%（示範資料）",
    updatedAt: new Date().toISOString(),
    source: NAME,
    isDemo: true,
    ok: true,
  };
}

export function levelFromReserveRate(rate: number): GridStatusLevel {
  if (rate < 3) return "critical";
  if (rate < 6) return "serious";
  if (rate < 10) return "warning";
  return "good";
}

const LEVEL_LABEL: Record<GridStatusLevel, string> = {
  good: "供電充裕",
  warning: "供電吃緊",
  serious: "限電警戒",
  critical: "限電準備",
};

// Untransformed upstream response, for /api/debug.
export async function fetchGridStatusRaw(): Promise<unknown> {
  const url = process.env.TAIPOWER_GRID_STATUS_URL;
  if (!url) throw new Error("TAIPOWER_GRID_STATUS_URL not configured");
  return fetchJson<unknown>(url);
}

export async function fetchGridStatus(): Promise<GridStatus> {
  const url = process.env.TAIPOWER_GRID_STATUS_URL;
  if (!url) {
    return demoStatus();
  }
  try {
    const raw = await fetchJson<Record<string, unknown> | Record<string, unknown>[]>(url);
    const record = Array.isArray(raw) ? raw[0] : raw;
    if (!record) throw new Error("empty response");

    const rateRaw = pick(record, "reserve_rate", "ReserveRate", "reserveRate");
    const rate = typeof rateRaw === "string" ? parseFloat(rateRaw) : Number(rateRaw);
    const noteText = pick(record, "note", "Note", "status_text") as string | undefined;
    const updateTime = pick(record, "curr_time", "CurrTime", "updateTime") as
      | string
      | undefined;

    if (!Number.isFinite(rate)) throw new Error("missing reserve_rate field");

    const level = levelFromReserveRate(rate);
    return {
      level,
      label: LEVEL_LABEL[level],
      detail: `備轉容量率 ${rate.toFixed(1)}%${noteText ? ` ・ ${noteText}` : ""}`,
      updatedAt: safeIso(updateTime ? `${updateTime.replace(" ", "T")}+08:00` : undefined),
      source: NAME,
      isDemo: false,
      ok: true,
    };
  } catch (err) {
    return {
      ...demoStatus(),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

import { Category, PulseEvent } from "@/lib/types";

export type FreshnessLevel = "current" | "expiring" | "expired" | "stale" | "static";

export interface Freshness {
  level: FreshnessLevel;
  label: string;
}

// Categories where the report itself doesn't have an official validity
// window, but old data is unlikely to still describe reality — flag it as
// "stale" past this many minutes so it doesn't get mistaken for a live
// state. Categories not listed here (e.g. earthquake) are treated as
// historical reports that don't "expire".
const STALE_THRESHOLD_MIN: Partial<Record<Category, number>> = {
  air: 180, // AQI 測站通常每小時更新
  traffic: 180, // 事故多半數小時內排除
  flood: 120, // 水位變化快
  fire: 720, // 新聞快訊，時效性較寬鬆
  security: 720,
  suspension: 1440, // 沒有 validUntil 時的保底（正常應該都會有 validUntil）
};

export function computeFreshness(event: PulseEvent, now: number = Date.now()): Freshness {
  if (event.validUntil) {
    const untilMs = new Date(event.validUntil).getTime();
    const diffMin = (untilMs - now) / 60000;
    if (diffMin < 0) return { level: "expired", label: "已過期" };
    if (diffMin <= 30) return { level: "expiring", label: "即將到期" };
    return { level: "current", label: "有效中" };
  }

  if (event.category === "earthquake") {
    return { level: "static", label: "歷史報告" };
  }

  const threshold = STALE_THRESHOLD_MIN[event.category];
  if (threshold === undefined) {
    return { level: "current", label: "" };
  }
  const ageMin = (now - new Date(event.time).getTime()) / 60000;
  if (ageMin > threshold) {
    return { level: "stale", label: "資料較舊，建議查核最新狀況" };
  }
  return { level: "current", label: "" };
}

// End of the current day in Taiwan (UTC+8), used by sources whose official
// validity is implicitly "for today" (e.g. 停班停課 announcements).
export function endOfTaiwanDay(from: Date = new Date()): string {
  const taipeiMs = from.getTime() + 8 * 60 * 60 * 1000;
  const taipeiDate = new Date(taipeiMs);
  taipeiDate.setUTCHours(23, 59, 59, 999);
  return new Date(taipeiDate.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

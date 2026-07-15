import { describe, it, expect } from "vitest";
import { computeFreshness, endOfTaiwanDay } from "./freshness";
import { PulseEvent } from "./types";

const NOW = new Date("2026-07-15T12:00:00.000Z").getTime();

const makeEvent = (overrides: Partial<PulseEvent> = {}): PulseEvent => ({
  id: "test-1",
  category: "air",
  title: "測試事件",
  severity: "warning",
  time: new Date(NOW - 10 * 60000).toISOString(),
  source: "測試來源",
  ...overrides,
});

describe("computeFreshness", () => {
  describe("— 有 validUntil 的事件", () => {
    it("正常情況：validUntil 在未來且超過 30 分鐘，視為有效中", () => {
      const event = makeEvent({ validUntil: new Date(NOW + 60 * 60000).toISOString() });
      expect(computeFreshness(event, NOW)).toEqual({ level: "current", label: "有效中" });
    });

    it("邊界情況：validUntil 在 30 分鐘內，視為即將到期", () => {
      const event = makeEvent({ validUntil: new Date(NOW + 20 * 60000).toISOString() });
      expect(computeFreshness(event, NOW).level).toBe("expiring");
    });

    it("正常情況：validUntil 已經過去，視為已過期", () => {
      const event = makeEvent({ validUntil: new Date(NOW - 60000).toISOString() });
      expect(computeFreshness(event, NOW).level).toBe("expired");
    });
  });

  describe("— 沒有 validUntil 的事件", () => {
    it("正常情況：地震一律視為歷史報告，不論多舊", () => {
      const event = makeEvent({
        category: "earthquake",
        time: new Date(NOW - 30 * 24 * 60 * 60000).toISOString(),
      });
      expect(computeFreshness(event, NOW)).toEqual({ level: "static", label: "歷史報告" });
    });

    it("正常情況：空氣品質超過 3 小時門檻視為資料較舊", () => {
      const event = makeEvent({ category: "air", time: new Date(NOW - 200 * 60000).toISOString() });
      expect(computeFreshness(event, NOW).level).toBe("stale");
    });

    it("邊界情況：空氣品質未超過 3 小時門檻視為目前", () => {
      const event = makeEvent({ category: "air", time: new Date(NOW - 100 * 60000).toISOString() });
      expect(computeFreshness(event, NOW).level).toBe("current");
    });

    it("正常情況：沒有設定門檻的類別（例如疫情監測）一律視為目前，不判斷過舊", () => {
      const event = makeEvent({
        category: "epidemic",
        time: new Date(NOW - 999 * 24 * 60 * 60000).toISOString(),
      });
      expect(computeFreshness(event, NOW).level).toBe("current");
    });
  });
});

describe("endOfTaiwanDay", () => {
  it("正常情況：回傳台灣當日 23:59:59.999（換算回 UTC 為 15:59:59.999）", () => {
    const from = new Date("2026-07-15T02:00:00.000Z"); // 台灣時間 07/15 10:00
    expect(endOfTaiwanDay(from)).toBe("2026-07-15T15:59:59.999Z");
  });

  it("邊界情況：接近台灣午夜（UTC 15:59）時仍算作同一個台灣日期", () => {
    const from = new Date("2026-07-15T15:58:00.000Z"); // 台灣時間 07/15 23:58
    expect(endOfTaiwanDay(from)).toBe("2026-07-15T15:59:59.999Z");
  });

  it("邊界情況：剛跨過台灣午夜（UTC 16:00）應算作下一個台灣日期", () => {
    const from = new Date("2026-07-15T16:00:00.000Z"); // 台灣時間 07/16 00:00
    expect(endOfTaiwanDay(from)).toBe("2026-07-16T15:59:59.999Z");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { severityFromAlertText, fetchLandslide, fetchLandslideRaw } from "./landslide";

describe("severityFromAlertText", () => {
  it("正常情況：文字包含「紅」視為危急", () => {
    expect(severityFromAlertText("紅色警戒")).toBe("critical");
    expect(severityFromAlertText("紅")).toBe("critical");
  });

  it("正常情況：黃色或其他文字預設為警戒（未確認是否有更細的分級欄位）", () => {
    expect(severityFromAlertText("黃色警戒")).toBe("serious");
  });

  it("邊界情況：空字串仍視為警戒（只要有發布就有意義）", () => {
    expect(severityFromAlertText("")).toBe("serious");
  });
});

describe("fetchLandslide", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mockFetchWith(body: unknown) {
    vi.stubEnv("LANDSLIDE_ALERT_URL", "https://example.com/alert");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, statusText: "OK", json: async () => body })
      )
    );
  }

  it("正常情況：無警戒時的 errorMessage 回應視為 0 筆、非失敗", async () => {
    mockFetchWith({ errorMessage: "目前無警戒" });
    const { events, status } = await fetchLandslide();
    expect(events).toEqual([]);
    expect(status.ok).toBe(true);
    expect(status.isDemo).toBe(false);
  });

  it("正常情況：有警戒時依縣市/鄉鎮/村里組成事件，歸類到 flood 分類", async () => {
    mockFetchWith([
      {
        County: "南投縣",
        Town: "信義鄉",
        Village: "神木村",
        AlertLevel: "紅色",
        PublishTime: "2026-07-20T10:00:00+08:00",
      },
    ]);
    const { events } = await fetchLandslide();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe("flood");
    expect(events[0].title).toContain("南投縣信義鄉神木村");
    expect(events[0].severity).toBe("critical");
    expect(events[0].county).toBe("南投縣");
  });

  it("邊界情況：缺少縣市欄位時跳過該筆，不硬塞無法定位的事件", async () => {
    mockFetchWith([{ Town: "信義鄉", AlertLevel: "黃色" }]);
    const { events, status } = await fetchLandslide();
    expect(events).toEqual([]);
    expect(status.ok).toBe(true);
  });

  it("邊界情況：上游請求失敗時退回示範資料", async () => {
    vi.stubEnv("LANDSLIDE_ALERT_URL", "https://example.com/alert");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch failed")))
    );
    const { events, status } = await fetchLandslide();
    expect(status.ok).toBe(false);
    expect(status.isDemo).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("fetchLandslideRaw：回傳原始回應，不經任何欄位轉換", async () => {
    mockFetchWith({ errorMessage: "目前無警戒" });
    const raw = await fetchLandslideRaw();
    expect(raw).toEqual({ errorMessage: "目前無警戒" });
  });
});

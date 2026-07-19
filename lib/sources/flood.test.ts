import { describe, it, expect, vi, afterEach } from "vitest";
import { severityFromLevels, fetchFlood, fetchFloodRaw } from "./flood";

describe("severityFromLevels", () => {
  it("正常情況：水位達一級警戒（最高）為危急", () => {
    expect(severityFromLevels(6, 5.8, 4.6, 3.5)).toBe("critical");
  });

  it("正常情況：水位介於二級與一級之間為警戒", () => {
    expect(severityFromLevels(5, 5.8, 4.6, 3.5)).toBe("serious");
  });

  it("正常情況：水位介於三級與二級之間為注意", () => {
    expect(severityFromLevels(4, 5.8, 4.6, 3.5)).toBe("warning");
  });

  it("邊界情況：水位低於所有門檻時視為正常，回傳 undefined", () => {
    expect(severityFromLevels(2, 5.8, 4.6, 3.5)).toBeUndefined();
  });

  it("邊界情況：剛好等於門檻視為已達該等級", () => {
    expect(severityFromLevels(5.8, 5.8, 4.6, 3.5)).toBe("critical");
    expect(severityFromLevels(4.6, 5.8, 4.6, 3.5)).toBe("serious");
    expect(severityFromLevels(3.5, 5.8, 4.6, 3.5)).toBe("warning");
  });

  it("【防迴歸】真實水利署站況資料曾出現空字串門檻——未定義的等級（undefined）必須被跳過，不能當成 0", () => {
    // A station with only level 1/2 defined (level 3 empty in the real
    // response) shouldn't fire "warning" for every positive water level.
    expect(severityFromLevels(1, 5.8, 4.6, undefined)).toBeUndefined();
  });

  it("邊界情況：完全沒有門檻資料時一律回傳 undefined", () => {
    expect(severityFromLevels(999, undefined, undefined, undefined)).toBeUndefined();
  });
});

// Real station-info record the user pasted back from
// /api/debug?source=flood (basinidentifier joins to the real-time feed's
// stationid).
const REAL_STATION_INFO = {
  affiliatedbasin: "1010",
  alertlevel1: "5.8",
  alertlevel2: "4.6",
  alertlevel3: "",
  basinidentifier: "1010H006",
  englishaddress: "Xinshuxi Bridge, Jinshan District, New Taipei City",
  englishname: "Xinshuxi Bridge",
  observatoryname: "新磺溪橋(即時)",
  rivername: "磺溪",
  locationbytwd97_xy: "313411.44 2790930.63",
};

describe("fetchFlood (join with station-info)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mockFetchWith(realtimeRecords: unknown[]) {
    vi.stubEnv("WRA_WATER_LEVEL_URL", "https://example.com/realtime");
    vi.stubEnv("WRA_WATER_STATION_INFO_URL", "https://example.com/station-info");
    const fetchMock = vi.fn((url: string) => {
      const body = url.includes("station-info") ? [REAL_STATION_INFO] : realtimeRecords;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  it("正常情況（真實資料，水位遠低於門檻）：不產生事件", async () => {
    // The exact real-time record the user pasted back — waterlevel 1.9 is
    // far below this station's thresholds (4.6/5.8), i.e. normal conditions.
    mockFetchWith([
      {
        stationid: "1010H006",
        checkresult: "true",
        checkdesc: null,
        observatoryidentifier: "1010H006_API",
        volt: null,
        datetime: "2026-07-19T18:30:00",
        waterlevel: "1.9",
      },
    ]);
    const { events, status } = await fetchFlood();
    expect(events).toEqual([]);
    expect(status.ok).toBe(true);
    expect(status.isDemo).toBe(false);
  });

  it("正常情況：水位超過門檻時產生事件，帶正確站名、嚴重程度與轉換後座標", async () => {
    mockFetchWith([
      {
        stationid: "1010H006",
        datetime: "2026-07-19T18:30:00",
        waterlevel: "5.0", // between level2 (4.6) and level1 (5.8) -> serious
      },
    ]);
    const { events } = await fetchFlood();
    expect(events).toHaveLength(1);
    expect(events[0].severity).toBe("serious");
    expect(events[0].title).toContain("新磺溪橋");
    expect(events[0].location?.lat).toBeCloseTo(25.2257, 3);
    expect(events[0].location?.lng).toBeCloseTo(121.6294, 3);
  });

  it("邊界情況：即時讀數對不到任何站況資料時跳過，不當機也不產生錯誤事件", async () => {
    mockFetchWith([
      { stationid: "UNKNOWN_STATION", datetime: "2026-07-19T18:30:00", waterlevel: "999" },
    ]);
    const { events, status } = await fetchFlood();
    expect(events).toEqual([]);
    expect(status.ok).toBe(true);
  });

  it("fetchFloodRaw：同時回傳即時讀數與站況資料的原始內容", async () => {
    vi.stubEnv("WRA_WATER_LEVEL_URL", "https://example.com/realtime");
    vi.stubEnv("WRA_WATER_STATION_INFO_URL", "https://example.com/station-info");
    const fetchMock = vi.fn((url: string) => {
      const body = url.includes("station-info") ? [REAL_STATION_INFO] : [{ stationid: "x" }];
      return Promise.resolve({ ok: true, status: 200, statusText: "OK", json: async () => body });
    });
    vi.stubGlobal("fetch", fetchMock);

    const raw = (await fetchFloodRaw()) as { realtime: unknown; stationInfo: unknown };
    expect(raw.realtime).toEqual([{ stationid: "x" }]);
    expect(raw.stationInfo).toEqual([REAL_STATION_INFO]);
  });
});

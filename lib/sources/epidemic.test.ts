import { describe, it, expect, vi, afterEach } from "vitest";
import {
  latestYearWeek,
  previousYearWeek,
  yearWeekToIso,
  severityFromErVisits,
  sumByCounty,
  fetchEpidemic,
  fetchEpidemicRaw,
} from "./epidemic";

describe("latestYearWeek", () => {
  it("正常情況：跨年份找出最新的年+週", () => {
    expect(
      latestYearWeek([
        { 年: "2025", 週: "52", 縣市: "台北市" },
        { 年: "2026", 週: "1", 縣市: "台北市" },
        { 年: "2026", 週: "28", 縣市: "台北市" },
      ])
    ).toEqual({ year: 2026, week: 28 });
  });

  it("邊界情況：空陣列回傳 undefined", () => {
    expect(latestYearWeek([])).toBeUndefined();
  });
});

describe("previousYearWeek", () => {
  it("正常情況：同一年往前一週", () => {
    expect(previousYearWeek(2026, 28)).toEqual({ year: 2026, week: 27 });
  });

  it("邊界情況：跨年份時回到上一年第 52 週", () => {
    expect(previousYearWeek(2026, 1)).toEqual({ year: 2025, week: 52 });
  });
});

describe("yearWeekToIso", () => {
  it("正常情況：回傳可解析的 ISO 字串", () => {
    const iso = yearWeekToIso(2026, 28);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});

describe("severityFromErVisits", () => {
  it("真實資料校準：台北市 2026-W28 的 96 人次為危急", () => {
    expect(severityFromErVisits(96)).toBe("critical");
  });

  it("真實資料校準：台南市 2026-W28 的 43 人次為警戒", () => {
    expect(severityFromErVisits(43)).toBe("serious");
  });

  it("真實資料校準：南投縣 2026-W28 的 11 人次為注意", () => {
    expect(severityFromErVisits(11)).toBe("warning");
  });

  it("邊界情況：低於門檻視為正常，回傳 undefined", () => {
    expect(severityFromErVisits(2)).toBeUndefined();
  });
});

describe("sumByCounty", () => {
  const records = [
    { 年: "2026", 週: "28", 縣市: "台北市", "COVID-19急診就診人次": "6" },
    { 年: "2026", 週: "28", 縣市: "台北市", "COVID-19急診就診人次": "9" },
    { 年: "2026", 週: "27", 縣市: "台北市", "COVID-19急診就診人次": "100" }, // wrong week, excluded
    { 年: "2026", 週: "28", 縣市: "新北市", "COVID-19急診就診人次": "3" },
  ];

  it("正常情況：依縣市加總同一年週的數值，跨年齡層", () => {
    const totals = sumByCounty(records, 2026, 28, "COVID-19急診就診人次");
    expect(totals.get("台北市")).toBe(15); // 6 + 9，排除週 27 的 100
    expect(totals.get("新北市")).toBe(3);
  });

  it("正常情況：可用 filter 篩選就診類別（住院 vs 門診）", () => {
    const nhiRecords = [
      { 年: "2026", 週: "28", 縣市: "台中市", 就診類別: "住院", "COVID-19健保就診人次": "25" },
      { 年: "2026", 週: "28", 縣市: "台中市", 就診類別: "門診", "COVID-19健保就診人次": "481" },
    ];
    const hosp = sumByCounty(
      nhiRecords,
      2026,
      28,
      "COVID-19健保就診人次",
      (r) => r["就診類別"] === "住院"
    );
    expect(hosp.get("台中市")).toBe(25);
  });
});

describe("fetchEpidemic (join RODS + NHI)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mockFetchWith(rods: unknown[], nhi: unknown[]) {
    vi.stubEnv("CDC_RODS_URL", "https://example.com/rods");
    vi.stubEnv("CDC_NHI_URL", "https://example.com/nhi");
    const fetchMock = vi.fn((url: string) => {
      const body = url.includes("rods") ? rods : nhi;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  it("正常情況（真實資料樣態）：超過門檻的縣市產生事件，帶趨勢與健保就診數", async () => {
    mockFetchWith(
      [
        { 年: "2026", 週: "27", 縣市: "台北市", "COVID-19急診就診人次": "72" },
        { 年: "2026", 週: "28", 縣市: "台北市", "COVID-19急診就診人次": "96" },
        { 年: "2026", 週: "28", 縣市: "澎湖縣", "COVID-19急診就診人次": "1" },
      ],
      [
        {
          年: "2026",
          週: "28",
          縣市: "台北市",
          就診類別: "住院",
          "COVID-19健保就診人次": "13",
        },
        {
          年: "2026",
          週: "28",
          縣市: "台北市",
          就診類別: "門診",
          "COVID-19健保就診人次": "605",
        },
      ]
    );
    const { events, status } = await fetchEpidemic();
    expect(events).toHaveLength(1); // 澎湖縣 1 人次低於門檻，不產生事件
    expect(events[0].county).toBe("台北市");
    expect(events[0].severity).toBe("critical");
    expect(events[0].title).toContain("96 人次");
    expect(events[0].description).toContain("較上週 +33%");
    expect(events[0].description).toContain("健保門診 605 人次");
    expect(events[0].description).toContain("住院 13 人次");
    expect(status.ok).toBe(true);
    expect(status.isDemo).toBe(false);
  });

  it("邊界情況：全部縣市都低於門檻時不產生事件，但仍視為成功", async () => {
    mockFetchWith(
      [{ 年: "2026", 週: "28", 縣市: "澎湖縣", "COVID-19急診就診人次": "1" }],
      []
    );
    const { events, status } = await fetchEpidemic();
    expect(events).toEqual([]);
    expect(status.ok).toBe(true);
    expect(status.isDemo).toBe(false);
  });

  it("邊界情況：上游請求失敗時退回示範資料", async () => {
    vi.stubEnv("CDC_RODS_URL", "https://example.com/rods");
    vi.stubEnv("CDC_NHI_URL", "https://example.com/nhi");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch failed")))
    );
    const { events, status } = await fetchEpidemic();
    expect(status.ok).toBe(false);
    expect(status.isDemo).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("fetchEpidemicRaw：同時回傳兩份原始資料", async () => {
    mockFetchWith([{ 年: "2026", 週: "28", 縣市: "x" }], [{ 年: "2026", 週: "28", 縣市: "x" }]);
    const raw = (await fetchEpidemicRaw()) as { rods: unknown; nhi: unknown };
    expect(raw.rods).toEqual([{ 年: "2026", 週: "28", 縣市: "x" }]);
    expect(raw.nhi).toEqual([{ 年: "2026", 週: "28", 縣市: "x" }]);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { pick, safeIso, safeIsoOrUndefined, fetchJson, parseNum, unwrapRecords } from "./util";

describe("pick", () => {
  it("正常情況：完全比對的鍵名直接命中", () => {
    expect(pick({ AQI: "158" }, "AQI")).toBe("158");
  });

  it("正常情況：大小寫不同時仍能命中", () => {
    expect(pick({ aqi: "158" }, "AQI")).toBe("158");
    expect(pick({ AQI: "158" }, "aqi")).toBe("158");
  });

  it("正常情況：依序嘗試多個候選鍵名，取第一個命中的", () => {
    expect(pick({ County: "高雄市" }, "county", "County", "縣市")).toBe("高雄市");
  });

  it("邊界情況：沒有任何鍵命中時回傳 undefined", () => {
    expect(pick({ foo: "bar" }, "AQI", "aqi")).toBeUndefined();
  });

  it("邊界情況：空物件回傳 undefined", () => {
    expect(pick({}, "AQI")).toBeUndefined();
  });
});

describe("safeIso", () => {
  it("正常情況：合法日期字串轉為 ISO 字串", () => {
    expect(safeIso("2024-01-01T12:00:00+08:00")).toBe("2024-01-01T04:00:00.000Z");
  });

  it("邊界情況：undefined 退回目前時間，不拋出例外", () => {
    expect(() => safeIso(undefined)).not.toThrow();
  });

  it("邊界情況：空字串退回目前時間", () => {
    expect(() => safeIso("")).not.toThrow();
  });

  it("錯誤情況：無法解析的字串退回目前時間，不拋出例外", () => {
    expect(() => safeIso("garbage")).not.toThrow();
    const result = safeIso("garbage");
    expect(Number.isNaN(new Date(result).getTime())).toBe(false);
  });

  it("【防迴歸】中央氣象署地震來源曾因日期格式不明確直接 throw RangeError，導致整批真實資料被丟棄退回示範資料——任何解析失敗都必須安全退回，不能拋出例外", () => {
    const malformed = ["2024-13-99", "not-a-date", "2024/13/99 99:99:99"];
    for (const value of malformed) {
      expect(() => safeIso(value)).not.toThrow();
    }
  });
});

describe("safeIsoOrUndefined", () => {
  it("正常情況：合法日期字串轉為 ISO 字串", () => {
    expect(safeIsoOrUndefined("2024-01-01T12:00:00+08:00")).toBe("2024-01-01T04:00:00.000Z");
  });

  it("邊界情況：undefined 保持 undefined（不像 safeIso 退回目前時間）", () => {
    expect(safeIsoOrUndefined(undefined)).toBeUndefined();
  });

  it("錯誤情況：無法解析的字串回傳 undefined，不拋出例外", () => {
    expect(() => safeIsoOrUndefined("garbage")).not.toThrow();
    expect(safeIsoOrUndefined("garbage")).toBeUndefined();
  });
});

describe("fetchJson 重試邏輯", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("正常情況：第一次就成功時只呼叫一次 fetch，不重試", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ hello: "world" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://example.com/data")).resolves.toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("【防迴歸】水利署水位/水庫端點曾回報 HTTP 503——503 之後重試，第二次成功就採用該結果", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ hello: "world" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchJson("https://example.com/data");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("錯誤情況：503 連續發生超過重試上限時，拋出最後一次的錯誤", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchJson("https://example.com/data");
    const assertion = expect(promise).rejects.toThrow("HTTP 503");
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("邊界情況：非暫時性錯誤（404）不重試，立即拋出", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://example.com/data")).rejects.toThrow("HTTP 404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("【防迴歸】CDC 疫情監測曾回報 'This operation was aborted'——逾時／連線層級錯誤（fetch 直接 reject，不是回傳 HTTP 狀態碼）不應重試，避免多次重試把已經很慢的請求拖得更久", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("This operation was aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://example.com/data")).rejects.toThrow("aborted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("parseNum", () => {
  it("正常情況：數字字串與數字都能解析", () => {
    expect(parseNum("5.8")).toBe(5.8);
    expect(parseNum(5.8)).toBe(5.8);
  });

  it("【防迴歸】水利署真實回應曾出現空字串代表「未設定」——不能被當成 0", () => {
    expect(parseNum("")).toBeUndefined();
  });

  it("邊界情況：undefined／null／無法解析的字串回傳 undefined", () => {
    expect(parseNum(undefined)).toBeUndefined();
    expect(parseNum(null)).toBeUndefined();
    expect(parseNum("not a number")).toBeUndefined();
  });
});

describe("unwrapRecords", () => {
  it("正常情況：本身就是陣列時直接回傳", () => {
    expect(unwrapRecords([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it("正常情況：包在 records 欄位底下", () => {
    expect(unwrapRecords({ records: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });

  it("正常情況：巢狀包在 result.records 底下（CKAN 常見外殼格式）", () => {
    expect(unwrapRecords({ result: { records: [{ a: 1 }] } })).toEqual([{ a: 1 }]);
  });

  it("邊界情況：都對不上時回傳空陣列，不拋出例外", () => {
    expect(unwrapRecords({ foo: "bar" })).toEqual([]);
    expect(unwrapRecords(null)).toEqual([]);
    expect(unwrapRecords(undefined)).toEqual([]);
  });
});

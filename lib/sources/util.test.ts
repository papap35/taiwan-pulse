import { describe, it, expect } from "vitest";
import { pick, safeIso, safeIsoOrUndefined } from "./util";

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

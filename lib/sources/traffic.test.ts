import { describe, it, expect } from "vitest";
import {
  severityFromDescription,
  findCounty,
  isRoutineConstruction,
  parseWktPoint,
} from "./traffic";

describe("severityFromDescription", () => {
  it("正常情況：封閉、坍方、中斷為危急", () => {
    expect(severityFromDescription("道路封閉")).toBe("critical");
    expect(severityFromDescription("邊坡坍方")).toBe("critical");
    expect(severityFromDescription("交通中斷")).toBe("critical");
  });

  it("正常情況：事故、車禍、回堵為警戒", () => {
    expect(severityFromDescription("發生事故")).toBe("serious");
    expect(severityFromDescription("車禍回堵約 3 公里")).toBe("serious");
  });

  it("正常情況（TDX 真實 Impact.Description 用詞）：全部阻斷為危急、部分阻斷為警戒", () => {
    expect(severityFromDescription("全部阻斷交通")).toBe("critical");
    expect(severityFromDescription("完全阻斷通行")).toBe("critical");
    expect(severityFromDescription("部分阻斷交通")).toBe("serious");
  });

  it("邊界情況：不含任何關鍵字時為一般", () => {
    expect(severityFromDescription("道路施工中")).toBe("info");
  });

  it("邊界情況：空字串為一般", () => {
    expect(severityFromDescription("")).toBe("info");
  });
});

describe("findCounty", () => {
  it("正常情況：文字中包含縣市名稱時回傳該縣市", () => {
    expect(findCounty("國道1號 北向 37K 新竹縣路段車禍事故")).toBe("新竹縣");
  });

  it("邊界情況：沒有縣市名稱時回傳 undefined", () => {
    expect(findCounty("國道1號 北向 37K 車禍事故")).toBeUndefined();
  });

  it("邊界情況：空字串回傳 undefined", () => {
    expect(findCounty("")).toBeUndefined();
  });
});

describe("isRoutineConstruction", () => {
  it("正常情況：施工/維修保養/定期養護視為例行事件", () => {
    expect(isRoutineConstruction("施工事件")).toBe(true);
    expect(isRoutineConstruction("道路維修保養")).toBe(true);
    expect(isRoutineConstruction("橋樑定期養護")).toBe(true);
  });

  it("邊界情況：不含施工關鍵字時為 false", () => {
    expect(isRoutineConstruction("車禍事故")).toBe(false);
    expect(isRoutineConstruction("")).toBe(false);
  });
});

describe("parseWktPoint", () => {
  it("正常情況：解析 TDX 真實回應的 WKT 座標字串（lng 在前、lat 在後）", () => {
    expect(parseWktPoint("POINT(121.199345 24.833352)")).toEqual({
      lat: 24.833352,
      lng: 121.199345,
    });
  });

  it("邊界情況：負數座標也能解析", () => {
    expect(parseWktPoint("POINT(-121.5 -24.5)")).toEqual({ lat: -24.5, lng: -121.5 });
  });

  it("錯誤情況：不是字串、格式不符或壞資料時回傳 undefined", () => {
    expect(parseWktPoint(undefined)).toBeUndefined();
    expect(parseWktPoint(123)).toBeUndefined();
    expect(parseWktPoint("not a point")).toBeUndefined();
  });
});

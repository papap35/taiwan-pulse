import { describe, it, expect } from "vitest";
import {
  severityFromDescription,
  findCounty,
  isRoutineConstruction,
  parseWktPoint,
  approximateRouteSegment,
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

describe("approximateRouteSegment", () => {
  const point = { lat: 24.833352, lng: 121.199345 };

  it("正常情況：北向/南向產生南北走向的線段（緯度變化、經度不變）", () => {
    for (const direction of ["北向", "南向"]) {
      const [a, b] = approximateRouteSegment(point, direction);
      expect(a.lng).toBe(point.lng);
      expect(b.lng).toBe(point.lng);
      expect(a.lat).not.toBe(b.lat);
    }
  });

  it("正常情況：東向/西向產生東西走向的線段（經度變化、緯度不變）", () => {
    for (const direction of ["東向", "西向"]) {
      const [a, b] = approximateRouteSegment(point, direction);
      expect(a.lat).toBe(point.lat);
      expect(b.lat).toBe(point.lat);
      expect(a.lng).not.toBe(b.lng);
    }
  });

  it("邊界情況：沒有方向文字，或方向文字含糊（例如雙向、內側）時預設南北走向", () => {
    for (const direction of ["", "雙向", "內側"]) {
      const [a, b] = approximateRouteSegment(point, direction);
      expect(a.lng).toBe(point.lng);
      expect(a.lat).not.toBe(b.lat);
    }
  });

  it("線段以事件座標為中心，兩端對稱", () => {
    const [a, b] = approximateRouteSegment(point, "北向");
    const midLat = (a.lat + b.lat) / 2;
    expect(midLat).toBeCloseTo(point.lat, 10);
  });
});

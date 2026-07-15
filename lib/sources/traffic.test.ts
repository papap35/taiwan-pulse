import { describe, it, expect } from "vitest";
import { severityFromDescription, findCounty } from "./traffic";

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

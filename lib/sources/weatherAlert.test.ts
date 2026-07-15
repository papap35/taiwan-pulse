import { describe, it, expect } from "vitest";
import { phenomenaToSeverity } from "./weatherAlert";

describe("phenomenaToSeverity", () => {
  it("正常情況：海嘯、強烈颱風、超大豪雨為危急", () => {
    expect(phenomenaToSeverity("海嘯")).toBe("critical");
    expect(phenomenaToSeverity("強烈颱風")).toBe("critical");
    expect(phenomenaToSeverity("超大豪雨")).toBe("critical");
  });

  it("正常情況：颱風、豪雨、土石流、強風為警戒", () => {
    expect(phenomenaToSeverity("颱風")).toBe("serious");
    expect(phenomenaToSeverity("豪雨")).toBe("serious");
    expect(phenomenaToSeverity("土石流")).toBe("serious");
    expect(phenomenaToSeverity("陸上強風特報")).toBe("serious");
  });

  it("正常情況：大雨、濃霧、低溫為注意", () => {
    expect(phenomenaToSeverity("大雨")).toBe("warning");
    expect(phenomenaToSeverity("濃霧")).toBe("warning");
    expect(phenomenaToSeverity("低溫特報")).toBe("warning");
  });

  it("邊界情況：完全沒有關鍵字比對到時為一般", () => {
    expect(phenomenaToSeverity("空氣品質")).toBe("info");
  });

  it("邊界情況：空字串為一般", () => {
    expect(phenomenaToSeverity("")).toBe("info");
  });
});

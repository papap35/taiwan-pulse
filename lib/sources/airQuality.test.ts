import { describe, it, expect } from "vitest";
import { aqiToSeverity } from "./airQuality";

describe("aqiToSeverity", () => {
  it("正常情況：AQI 200 以上為危急", () => {
    expect(aqiToSeverity(200)).toBe("critical");
    expect(aqiToSeverity(300)).toBe("critical");
  });

  it("正常情況：AQI 150 至 199 為警戒", () => {
    expect(aqiToSeverity(150)).toBe("serious");
    expect(aqiToSeverity(199)).toBe("serious");
  });

  it("正常情況：AQI 100 至 149 為注意", () => {
    expect(aqiToSeverity(100)).toBe("warning");
    expect(aqiToSeverity(149)).toBe("warning");
  });

  it("正常情況：AQI 低於 100 為一般", () => {
    expect(aqiToSeverity(50)).toBe("info");
  });

  it("邊界情況：AQI 0 為一般", () => {
    expect(aqiToSeverity(0)).toBe("info");
  });
});

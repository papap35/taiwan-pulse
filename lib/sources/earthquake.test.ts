import { describe, it, expect } from "vitest";
import { magnitudeToSeverity } from "./earthquake";

describe("magnitudeToSeverity", () => {
  it("正常情況：規模 6.5 以上為危急", () => {
    expect(magnitudeToSeverity(6.5)).toBe("critical");
    expect(magnitudeToSeverity(7.2)).toBe("critical");
  });

  it("正常情況：規模 5.5 至 6.4 為警戒", () => {
    expect(magnitudeToSeverity(5.5)).toBe("serious");
    expect(magnitudeToSeverity(6.4)).toBe("serious");
  });

  it("正常情況：規模 4.5 至 5.4 為注意", () => {
    expect(magnitudeToSeverity(4.5)).toBe("warning");
    expect(magnitudeToSeverity(5.4)).toBe("warning");
  });

  it("正常情況：規模低於 4.5 為一般", () => {
    expect(magnitudeToSeverity(3.0)).toBe("info");
  });

  it("邊界情況：規模 0 為一般", () => {
    expect(magnitudeToSeverity(0)).toBe("info");
  });
});

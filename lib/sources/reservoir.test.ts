import { describe, it, expect } from "vitest";
import { severityFromStoragePct } from "./reservoir";

describe("severityFromStoragePct", () => {
  it("正常情況：蓄水率低於 10% 為危急", () => {
    expect(severityFromStoragePct(5)).toBe("critical");
    expect(severityFromStoragePct(0)).toBe("critical");
  });

  it("正常情況：蓄水率 10% 至 19% 為警戒", () => {
    expect(severityFromStoragePct(10)).toBe("serious");
    expect(severityFromStoragePct(19)).toBe("serious");
  });

  it("正常情況：蓄水率 20% 至 29% 為注意", () => {
    expect(severityFromStoragePct(20)).toBe("warning");
    expect(severityFromStoragePct(29)).toBe("warning");
  });

  it("邊界情況：負值（不應發生，但仍需有明確行為）視為危急", () => {
    expect(severityFromStoragePct(-1)).toBe("critical");
  });
});

import { describe, it, expect } from "vitest";
import { levelFromReserveRate } from "./gridStatus";

describe("levelFromReserveRate", () => {
  it("正常情況：備轉容量率低於 3% 為限電準備", () => {
    expect(levelFromReserveRate(2)).toBe("critical");
    expect(levelFromReserveRate(0)).toBe("critical");
  });

  it("正常情況：備轉容量率 3% 至 5.9% 為限電警戒", () => {
    expect(levelFromReserveRate(3)).toBe("serious");
    expect(levelFromReserveRate(5.9)).toBe("serious");
  });

  it("正常情況：備轉容量率 6% 至 9.9% 為供電吃緊", () => {
    expect(levelFromReserveRate(6)).toBe("warning");
    expect(levelFromReserveRate(9.9)).toBe("warning");
  });

  it("正常情況：備轉容量率 10% 以上為供電充裕", () => {
    expect(levelFromReserveRate(10)).toBe("good");
    expect(levelFromReserveRate(20)).toBe("good");
  });
});

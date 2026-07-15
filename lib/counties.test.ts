import { describe, it, expect } from "vitest";
import { countyCentroid } from "./counties";

describe("countyCentroid", () => {
  it("正常情況：完整縣市名稱回傳對應座標", () => {
    expect(countyCentroid("高雄市")).toEqual({ lat: 22.6273, lng: 120.3014 });
  });

  it("正常情況：文字中包含縣市名稱也能比對到（不需完全相等）", () => {
    expect(countyCentroid("高雄市前鎮區")).toEqual({ lat: 22.6273, lng: 120.3014 });
  });

  it("正常情況：舊式「臺」與「台」寫法回傳相同座標", () => {
    expect(countyCentroid("臺北市")).toEqual(countyCentroid("台北市"));
  });

  it("邊界情況：undefined 回傳 undefined，不拋出例外", () => {
    expect(countyCentroid(undefined)).toBeUndefined();
  });

  it("邊界情況：空字串回傳 undefined", () => {
    expect(countyCentroid("")).toBeUndefined();
  });

  it("錯誤情況：不是任何縣市名稱的文字回傳 undefined", () => {
    expect(countyCentroid("東京都")).toBeUndefined();
  });
});

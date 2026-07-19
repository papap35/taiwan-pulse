import { describe, it, expect } from "vitest";
import { twd97ToWgs84, parseTwd97String } from "./geo";

describe("twd97ToWgs84", () => {
  it("【防迴歸】真實水位站座標轉換：新磺溪橋站（新北市金山區）", () => {
    // From a real WRA station-info record the user pasted back
    // (basinidentifier "1010H006", observatoryname "新磺溪橋(即時)",
    // englishaddress "Jinshan District, New Taipei City"). New Taipei's
    // Jinshan District is on the north coast, ~25.2°N 121.6°E — the
    // converted result should land there, not somewhere else in Taiwan.
    const { lat, lng } = twd97ToWgs84(313411.44, 2790930.63);
    expect(lat).toBeCloseTo(25.2257, 3);
    expect(lng).toBeCloseTo(121.6294, 3);
  });
});

describe("parseTwd97String", () => {
  it("正常情況：解析「x y」空白分隔的座標字串", () => {
    expect(parseTwd97String("313411.44 2790930.63")).toEqual({ x: 313411.44, y: 2790930.63 });
  });

  it("邊界情況：非字串、空字串或格式不符時回傳 undefined", () => {
    expect(parseTwd97String(undefined)).toBeUndefined();
    expect(parseTwd97String("")).toBeUndefined();
    expect(parseTwd97String("313411.44")).toBeUndefined();
    expect(parseTwd97String("not a coordinate")).toBeUndefined();
  });
});

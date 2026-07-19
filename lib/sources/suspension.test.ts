import { describe, it, expect } from "vitest";
import { severityFromText } from "./suspension";

describe("severityFromText", () => {
  it("正常情況：同時停止上班與停止上課為警戒", () => {
    expect(severityFromText("停止上班停止上課")).toBe("serious");
  });

  it("正常情況：「停班停課」字樣直接視為警戒", () => {
    expect(severityFromText("花蓮縣停班停課")).toBe("serious");
  });

  it("正常情況：只有停止上班或只有停止上課為注意", () => {
    expect(severityFromText("停止上班（部分地區）")).toBe("warning");
    expect(severityFromText("停止上課")).toBe("warning");
  });

  it("邊界情況：正常上班上課文字視為一般", () => {
    expect(severityFromText("正常上班上課")).toBe("info");
  });

  it("邊界情況：空字串為一般", () => {
    expect(severityFromText("")).toBe("info");
  });
});

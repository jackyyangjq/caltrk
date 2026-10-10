import { describe, expect, it } from "vitest";
import { transcriptOf } from "../../src/lib/speech.js";

const res = (...parts) => parts.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin }));

describe("transcriptOf", () => {
  it("appends incremental final segments and keeps the unfinished tail separate", () => {
    expect(transcriptOf(res(["一碗牛肉面", true], ["加一个卤蛋", true], ["还有半", false])))
      .toEqual({ final: "一碗牛肉面加一个卤蛋", interim: "还有半" });
  });
  it("does not duplicate when each final segment repeats everything so far", () => {
    expect(transcriptOf(res(["一碗牛肉面", true], ["一碗牛肉面加一个卤蛋", true])).final).toBe("一碗牛肉面加一个卤蛋");
  });
  it("skips an exact repeat of the last segment and empty results", () => {
    expect(transcriptOf(res(["一碗面", true], ["一碗面", true], ["", true])).final).toBe("一碗面");
    expect(transcriptOf([])).toEqual({ final: "", interim: "" });
  });
});

import { describe, expect, it } from "vitest";
import { dateShift, dayTotals, daysBetween, mealOf } from "../../src/lib/util.js";
import { mergeMissing } from "../../src/lib/backup.js";

describe("day boundaries", () => {
  it("mealOf splits at 11/16/22", () => {
    expect(["T10:59", "T11:00", "T15:59", "T16:00", "T21:59", "T22:00", "T00:10"].map(t => mealOf("2026-10-06" + t)))
      .toEqual(["早餐", "午餐", "午餐", "晚餐", "晚餐", "夜宵", "早餐"]);
  });
  it("dateShift crosses month and year ends", () => {
    expect(dateShift("2026-10-01", -1)).toBe("2026-09-30");
    expect(dateShift("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("dateShift and daysBetween are stable across the UK clock change", () => {
    expect(dateShift("2026-10-24", 2)).toBe("2026-10-26");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("dayTotals", () => {
  it("sums macros and flags guesses", () => {
    const t = dayTotals([{ kcal: 100, protein: 10.04, fat: 1, carb: 2 }, { kcal: 640, protein: null, confidence: "guess", pending: true }]);
    expect(t).toEqual({ intake: 740, prot: 10, fat: 1, carb: 2, hasGuess: true });
  });
});

describe("mergeMissing (backup import)", () => {
  it("adds only unseen keys and skips junk", () => {
    const cur = [{ id: "a" }];
    const n = mergeMissing(cur, [{ id: "a" }, { id: "b" }, null, "x", { nope: 1 }, { id: "b" }], x => x.id || null);
    expect(n).toBe(1);
    expect(cur.map(x => x.id)).toEqual(["a", "b"]);
  });
});

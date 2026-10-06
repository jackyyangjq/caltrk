import { describe, expect, it } from "vitest";
import { addedCmpOf, agoLabelAt, rankChips, recentCmpOf, usageStatsOf } from "../../src/lib/ranking.js";

const today = "2026-10-06";
const log = [
  { food_id: "a", ts: "2026-10-05T08:00" },                       // 1 day ago, breakfast: 3 × 1.6
  { food_id: "b", ts: "2026-09-25T13:00" }, { food_id: "b", ts: "2026-09-24T13:00" },   // 11-12 days: 2 + 2
  { food_id: "old-dup", ts: "2026-08-01T19:00" },                 // >29 days: 0.4, merged into "c"
  { food_id: null, ts: "2026-10-06T08:00" },
];

describe("usageStatsOf", () => {
  const u = usageStatsOf(log, { "old-dup": "c" }, today, "早餐");
  it("weights recent use and the current meal slot", () => {
    expect(u.score.a).toBeCloseTo(4.8);
    expect(u.score.b).toBe(4);
    expect(u.score.c).toBeCloseTo(0.4);
  });
  it("merges duplicates into the surviving id", () => {
    expect(u.last.c).toBe("2026-08-01T19:00");
    expect(u.last["old-dup"]).toBeUndefined();
  });
});

describe("ordering", () => {
  const library = [{ id: "c" }, { id: "b" }, { id: "a" }, { id: "z" }];
  const mine = { id: "uf-1", added: "2026-10-01" }, mine2 = { id: "uf-2", added: "2026-09-01" };
  it("addedCmp puts personal foods first, newest first, then library newest first", () => {
    expect([...library, mine2, mine].sort(addedCmpOf(library)).map(f => f.id)).toEqual(["uf-1", "uf-2", "z", "a", "b", "c"]);
  });
  it("recentCmp puts last-eaten first", () => {
    const u = usageStatsOf(log, { "old-dup": "c" }, today, "午餐");
    expect([...library].sort(recentCmpOf(u, library)).map(f => f.id)).toEqual(["a", "b", "c", "z"]);
  });
  it("rankChips sorts by score then recency", () => {
    const u = usageStatsOf(log, { "old-dup": "c" }, today, "午餐");   // b eaten at lunch: 2×1.6×2 = 6.4 > a: 3
    expect(rankChips(library, u, library, 2).map(f => f.id)).toEqual(["b", "a"]);
  });
});

describe("agoLabelAt", () => {
  it("labels by calendar day", () => {
    expect(["2026-10-06T23:00", "2026-10-05T01:00", "2026-09-23T00:00", "2026-09-22T00:00"].map(t => agoLabelAt(t, today)))
      .toEqual(["今天", "昨天", "13 天前", "09/22"]);
  });
});

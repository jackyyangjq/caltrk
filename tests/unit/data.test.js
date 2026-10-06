import { describe, expect, it } from "vitest";
import { BUILD } from "../../src/build.js";
import { COMBOS, FOOD_LIBRARY, UF_FIX } from "../../src/data/foods.js";
import { LOG_FIX } from "../../src/data/logfix.js";
import { applyLogFixesTo } from "../../src/lib/logfix.js";

/* 每周复盘改数据时的护栏 */
describe("food library integrity", () => {
  it("ids are unique and every default portion exists", () => {
    const ids = FOOD_LIBRARY.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FOOD_LIBRARY) expect(f.portions.map(p => p.label), f.id).toContain(f.default_portion);
  });
  it("label-read (high confidence) entries pass the 4/4/9 check within 15%", () => {
    for (const f of FOOD_LIBRARY.filter(x => x.confidence === "high")) {
      const p = f.per_100g, calc = 4 * p.protein + 4 * p.carb + 9 * p.fat;
      expect(Math.abs(calc - p.kcal) / p.kcal, f.id).toBeLessThan(0.15);
    }
  });
  it("overlay fixes keep their default portion valid", () => {
    for (const [id, fx] of Object.entries(UF_FIX)) if (fx.portions) expect(fx.portions.map(p => p.label), id).toContain(fx.default_portion);
  });
  it("combos reference real foods", () => {
    for (const c of COMBOS) for (const [id] of c.items) expect(FOOD_LIBRARY.some(f => f.id === id), id).toBe(true);
  });
});

describe("BUILD constants", () => {
  it("macro caps add up to the daily target (protein 4, fat 9, carb 4)", () => {
    expect(BUILD.protein_target * 4 + BUILD.fat_target * 9 + BUILD.carb_target * 4).toBe(BUILD.kcal_target);
  });
});

describe("applyLogFixesTo", () => {
  it("applies each fix once, keeps the original values, and re-applies on a new rev", () => {
    const fixes = { e1: { kcal: 200, food_id: "x", why: "w" } };
    const log = [{ id: "e1", kcal: 100, name_raw: "n" }, { id: "e2", kcal: 5 }];
    const done = [];
    expect(applyLogFixesTo(log, done, fixes)).toBe(true);
    expect(log[0]).toMatchObject({ kcal: 200, food_id: "x", fix_why: "w", orig: { kcal: 100, food_id: null, name_raw: "n" } });
    expect(done).toEqual(["e1"]);
    log[0].kcal = 150;   // a later manual edit must survive
    expect(applyLogFixesTo(log, done, fixes)).toBe(false);
    expect(log[0].kcal).toBe(150);
    fixes.e1 = { kcal: 210, rev: 2, why: "w2" };
    expect(applyLogFixesTo(log, done, fixes)).toBe(true);
    expect(log[0].kcal).toBe(210);
    expect(log[0].orig.kcal).toBe(100);
    expect(done).toEqual(["e1", "e1#2"]);
  });
  it("shipped fixes all carry a reason", () => {
    for (const [id, fx] of Object.entries(LOG_FIX)) expect(typeof fx.why, id).toBe("string");
  });
});

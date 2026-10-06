import { describe, expect, it } from "vitest";
import { atwaterWarn, compareSpecs, scanChecks, validateFoodSpec, webCheck } from "../../src/lib/checks.js";

const per = (kcal, protein, fat, carb) => ({ kcal, protein, fat, carb });

describe("atwaterWarn", () => {
  it("passes when 4/4/9 matches the printed kcal", () => {
    expect(atwaterWarn(per(375, 11, 8, 60), "")).toBeNull();
  });
  it("flags a deviation above 30%", () => {
    expect(atwaterWarn(per(500, 10, 5, 40), "x ")).toMatch(/^x 热量和碳蛋脂对不上（标 500，按碳蛋脂算约 245）/);
  });
  it("ignores very low-calorie foods and all-zero macros", () => {
    expect(atwaterWarn(per(30, 0, 0, 1), "")).toBeNull();
    expect(atwaterWarn(per(200, 0, 0, 0), "")).toBeNull();
  });
});

describe("validateFoodSpec (whole-pack cross-check)", () => {
  it("catches a per-serving column read as per-100 g", () => {
    const v = validateFoodSpec({ per_100g: per(120, 5, 4, 15), pack_grams: 500, pack_kcal: 300 });
    expect(v.warns.join()).toMatch(/整包交叉验证不一致（每100g×500g≈600，标签写 300）/);
  });
  it("accepts a pack within 12%", () => {
    const v = validateFoodSpec({ per_100g: per(120, 5, 4, 15), pack_grams: 500, pack_kcal: 640 });
    expect(v.warns).toEqual([]);
    expect(v.oks).toEqual(["整包交叉验证一致"]);
  });
  it("notes when there is no pack kcal to check against", () => {
    expect(validateFoodSpec({ per_100g: per(120, 5, 4, 15) }).oks).toEqual(["标签无整包热量，未能交叉验证"]);
  });
});

describe("compareSpecs (second-model diff)", () => {
  it("is quiet when both readings agree", () => {
    expect(compareSpecs({ per_100g: per(200, 10, 8, 20) }, { per_100g: per(210, 11, 8.5, 21) })).toEqual([]);
  });
  it("lists every field that differs", () => {
    const d = compareSpecs({ per_100g: per(200, 10, 8, 20) }, { per_100g: per(260, 10, 2, 20) });
    expect(d[0]).toContain("kcal 200 vs 260");
    expect(d[0]).toContain("fat 8 vs 2");
  });
});

describe("webCheck / scanChecks", () => {
  it("webCheck counts fibre at 2 kcal/g", () => {
    expect(webCheck(per(263, 10.4, 5.6, 40.1), 6.2)).toBe(true);
    expect(webCheck(per(263, 10.4, 15, 40.1), 0)).toBe(false);
  });
  it("scanChecks reports missing macros and impossible totals", () => {
    expect(scanChecks({ kcal: 100, protein: null, fat: 1, carb: 20 }, {})[0]).toMatch(/^蛋白质没有数据/);
    expect(scanChecks(per(400, 60, 10, 40), {}).join()).toMatch(/超过 100 g/);
  });
  it("scanChecks counts polyols at 2.4 and alcohol at 7", () => {
    expect(scanChecks(per(160, 0, 0, 60), { polyols: 50 })).toEqual([]);   // 4×10 + 2.4×50
    expect(scanChecks(per(240, 0, 0, 60), { polyols: 50 })).toHaveLength(1);
    expect(scanChecks(per(70, 0, 0, 0), { alcohol: 10 })).toEqual([]);
  });
});

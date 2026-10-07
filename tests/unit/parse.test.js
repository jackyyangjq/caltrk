import { describe, expect, it } from "vitest";
import { aiParseFood, aiParseMeal, gtinValid, normBarcode, offToSpec, webParse } from "../../src/lib/parse.js";

describe("aiParseFood", () => {
  const good = { name: "Tesco 希腊酸奶", per_100g: { kcal: 120.4, protein: 5.04, fat: 9.6, carb: 3.9 },
    portions: [{ label: "整盒", grams: 500 }, { label: "一份", grams: 150 }], default_portion: "一份",
    pack_grams: 500, pack_kcal: 600, note: "实读", read: { kcal: true, protein: true, fat: false, carb: true },
    search: "Tesco  Greek\nYogurt", barcode: "5 057753 936686" };
  it("parses a JSON object wrapped in prose and code fences", () => {
    const s = aiParseFood("好的：\n```json\n" + JSON.stringify(good) + "\n```");
    expect(s.per_100g).toEqual({ kcal: 120, protein: 5, fat: 9.6, carb: 3.9 });
    expect(s.default_portion).toBe("一份");
    expect(s.unread).toEqual(["fat"]);
    expect(s.search).toBe("Tesco Greek Yogurt");
    expect(s.barcode).toBe("5057753936686");
  });
  it("rejects out-of-range values", () => {
    expect(aiParseFood(JSON.stringify({ ...good, per_100g: { ...good.per_100g, kcal: 1200 } }))).toBeNull();
    expect(aiParseFood("no json here")).toBeNull();
  });
  it("falls back to a 100 g portion and treats missing `read` as all unread", () => {
    const s = aiParseFood(JSON.stringify({ name: "x", per_100g: good.per_100g }));
    expect(s.portions).toEqual([{ label: "100 g", grams: 100 }]);
    expect(s.unread).toEqual(["kcal", "protein", "fat", "carb"]);
  });
});

describe("aiParseMeal", () => {
  it("keeps valid items, drops broken ones, and notes Atwater failures", () => {
    const m = aiParseMeal(JSON.stringify({ items: [
      { name: "米饭", grams: 180.4, per_100g: { kcal: 116, protein: 2.6, fat: 0.3, carb: 25.9 } },
      { name: "坏的", grams: 0, per_100g: { kcal: 100 } },
      { name: "可疑", grams: 100, per_100g: { kcal: 500, protein: 1, fat: 1, carb: 1 } },
    ], note: "估" }));
    expect(m.items.map(i => i.name)).toEqual(["米饭", "可疑"]);
    expect(m.items[0].grams).toBe(180);
    expect(m.note).toMatch(/^估；⚠ 可疑 热量和碳蛋脂对不上/);
  });
  it("returns null when nothing usable comes back", () => {
    expect(aiParseMeal('{"items":[]}')).toBeNull();
  });
});

describe("webParse", () => {
  it("only accepts found:true with all four numbers", () => {
    expect(webParse('{"found":false}')).toBeNull();
    expect(webParse('{"found":true,"per_100g":{"kcal":100,"protein":1,"fat":1}}')).toBeNull();
    const w = webParse('{"found":true,"matched_name":"X","per_100g":{"kcal":99.6,"protein":1,"fat":1,"carb":20,"fiber":2},"source":"u"}');
    expect(w.per_100g.kcal).toBe(100);
    expect(w.fiber).toBe(2);
    expect(w.src).toBe("X u");
  });
});

describe("offToSpec (Open Food Facts → food)", () => {
  it("uses per-100 g values and builds portions", () => {
    const s = offToSpec({ brands: "Tesco", product_name: "Seeded Loaf", product_quantity: 800, serving_quantity: 44,
      nutriments: { "energy-kcal_100g": 263, proteins_100g: 10.4, fat_100g: 5.6, carbohydrates_100g: 40.1, fiber_100g: 6.2 } }, "1");
    expect(s.name).toBe("Tesco Seeded Loaf");
    expect(s.per_100g).toEqual({ kcal: 263, protein: 10.4, fat: 5.6, carb: 40.1 });
    expect(s.portions.map(p => p.label)).toEqual(["一份（标签）44g", "整包 800g", "100 g"]);
  });
  it("converts kJ and derives per-100 g from per-serving values", () => {
    const s = offToSpec({ product_name: "Juice", product_quantity_unit: "ml", serving_quantity: 250,
      nutriments: { "energy-kj_serving": 1046, proteins_serving: 2.5, fat_serving: 0, carbohydrates_serving: 25 } }, "1");
    expect(s.per_100g).toEqual({ kcal: 100, protein: 1, fat: 0, carb: 10 });
    expect(s.ml).toBe(true);
  });
  it("returns null without energy", () => {
    expect(offToSpec({ nutriments: { proteins_100g: 3 } }, "1")).toBeNull();
  });
});

describe("barcodes", () => {
  it("normalises UPC-A to EAN-13", () => {
    expect(normBarcode("0 12345 67890 5")).toBe("0012345678905");
  });
  it("validates the check digit", () => {
    expect(gtinValid("5057753936686")).toBe(true);
    expect(gtinValid("5057753936687")).toBe(false);
    expect(gtinValid("96385074")).toBe(true);
    expect(gtinValid("123")).toBe(false);
  });
});

describe("aiParseMeal portions and transcript (v2.2)", () => {
  it("keeps 2-4 portions, de-duplicated and sorted by grams, plus the heard text", () => {
    const m = aiParseMeal(JSON.stringify({ heard: " 一碗面 ", items: [{ name: "面", grams: 300, per_100g: { kcal: 110, protein: 4, fat: 2, carb: 20 },
      portions: [{ label: "大碗", grams: 450 }, { label: "小碗", grams: 200 }, { label: "中碗", grams: 300 }, { label: "又一个中碗", grams: 300 },
        { label: "", grams: 100 }, { label: "超大", grams: 5000 }, { label: "特大碗", grams: 600 }, { label: "桶", grams: 900 }] }] }));
    expect(m.heard).toBe("一碗面");
    expect(m.items[0].portions).toEqual([{ label: "小碗", grams: 200 }, { label: "中碗", grams: 300 }, { label: "大碗", grams: 450 }, { label: "特大碗", grams: 600 }]);
  });
  it("leaves portions off when the model gives none", () => {
    const m = aiParseMeal('{"items":[{"name":"x","grams":100,"per_100g":{"kcal":100,"protein":5,"fat":4,"carb":10}}]}');
    expect(m.items[0].portions).toBeUndefined();
    expect(m.heard).toBeUndefined();
  });
});

// Deterministic localStorage fixture shared by the e2e scripts: ~3 weeks of logs, weights, training and user foods.
export const NOW = "2026-10-06T09:30:00";

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function shift(date, n) {
  const x = new Date(date + "T12:00"); x.setDate(x.getDate() + n);
  return x.getFullYear() + "-" + pad2(x.getMonth() + 1) + "-" + pad2(x.getDate());
}

export function buildFixture() {
  const rnd = mulberry(42);
  const today = NOW.slice(0, 10);
  const foods = [
    ["oats-dry", "燕麦片（干）", 375, 11, 8, 60, 40],
    ["on-whey-strawberry", "Optimum Nutrition 草莓乳清蛋白粉", 378, 79, 4.2, 5.5, 48],
    ["tesco-multiseed-bread", "Tesco 多种籽面包", 261, 9.7, 4.5, 43.3, 100],
    ["chicken-breast", "鸡胸肉（熟）", 165, 31, 3.6, 0, 150],
    ["rice-cooked", "米饭（熟）", 116, 2.6, 0.3, 25.9, 200],
    ["uf-test0001", "测试个人食物 A", 200, 10, 5, 20, 120],
    ["uf-mtwo4ipo", "旧个人条目（已转正为多种籽面包）", 261, 9.7, 4.5, 43.3, 50],
  ];
  const log = [], weight = [], days = [], training = [];
  let kg = 83.2;
  for (let d = -20; d <= 0; d++) {
    const date = shift(today, d);
    if (d !== -9) {
      const n = d === 0 ? 1 : 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const f = foods[Math.floor(rnd() * foods.length)];
        const g = Math.round(f[6] * (0.6 + rnd() * 0.8));
        const h = d === 0 ? 8 : [8, 12, 13, 19, 22][Math.floor(rnd() * 5)];
        log.push({ id: "fx" + (d + 30) + "x" + i, ts: date + "T" + pad2(h) + ":" + pad2(Math.floor(rnd() * 60)),
          food_id: f[0], name: f[1], portion: g + " g", grams: g,
          kcal: Math.round(f[2] * g / 100), protein: Math.round(f[3] * g) / 100, fat: Math.round(f[4] * g) / 100,
          carb: Math.round(f[5] * g) / 100, confidence: "high", pending: false });
      }
      if (d % 4 === 0 && d < 0) {
        log.push({ id: "fxg" + (d + 30), ts: date + "T20:10", food_id: null, name_raw: "外卖估计", grams: null,
          kcal: 640, protein: null, confidence: "guess", pending: true, amount_note: "一半" });
      }
      if (d === -3) {
        log.push({ id: "fxai1", ts: date + "T13:05", food_id: null, name_raw: "牛肉面", portion: "450 g", grams: 450,
          kcal: 540, protein: 30, fat: 14, carb: 70, per_100g: { kcal: 120, protein: 6.7, fat: 3.1, carb: 15.6 },
          confidence: "low", pending: false, ai: true });
      }
    }
    if (d < 0 && rnd() < 0.85) { kg -= 0.05 + (rnd() - 0.5) * 0.5; weight.push({ date, kg: Math.round(kg * 10) / 10, context: "morning" }); }
    if (d % 3 === 0) weight.push({ date, kg: Math.round((kg + 0.8) * 10) / 10, context: "gym_pre" });
    if (d < -1 && rnd() < 0.7) days.push({ date, complete: true });
    if (d % 2 === 0) training.push({ date, types: ["strength"], mins: { strength: 90 } });
  }
  const userFoods = [
    { id: "uf-test0001", name: "测试个人食物 A", per_100g: { kcal: 200, protein: 10, fat: 5, carb: 20 },
      portions: [{ label: "一份 120g", grams: 120 }], default_portion: "一份 120g", confidence: "low",
      note: "AI 识别：测试", added: shift(today, -10) },
    { id: "uf-mtwo4ipo", name: "旧多种籽面包", per_100g: { kcal: 261, protein: 9.7, fat: 4.5, carb: 43.3 },
      portions: [{ label: "一片", grams: 50 }], default_portion: "一片", confidence: "low", added: shift(today, -15) },
    { id: "uf-test0002", name: "Tesco Chicken Caesar Wrap", per_100g: { kcal: 230, protein: 11, fat: 9, carb: 25 },
      portions: [{ label: "整个", grams: 210 }], default_portion: "整个", confidence: "high", added: shift(today, -2),
      barcode: "5000119000006" },
  ];
  const settings = { last_export_confirm: shift(today, -9) + "T21:00", banner_dismiss: {} };
  return {
    "caltrk7f3a.log.v1": JSON.stringify(log),
    "caltrk7f3a.weight.v1": JSON.stringify(weight),
    "caltrk7f3a.days.v1": JSON.stringify(days),
    "caltrk7f3a.settings.v1": JSON.stringify(settings),
    "caltrk7f3a.training.v1": JSON.stringify(training),
    "caltrk7f3a.userfoods.v1": JSON.stringify(userFoods),
    "caltrk7f3a.ai.v1": JSON.stringify({ key: "sk-test-1234567890", model: "gemini-3.8-flash", m26: 1 }),
  };
}

// Make Date fixed and Math.random deterministic inside the page.
export const INIT_SCRIPT = `
(() => {
  let s = 1234567;
  Math.random = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
})();`;

// Canned network responses for the AI endpoint and Open Food Facts.
export const MOCK = {
  meal: JSON.stringify({ items: [
    { name: "番茄炒蛋", grams: 220, per_100g: { kcal: 95, protein: 6, fat: 6.5, carb: 4 } },
    { name: "米饭（熟）", grams: 180, per_100g: { kcal: 116, protein: 2.6, fat: 0.3, carb: 25.9 } },
  ], note: "按家常做法估" }),
  label: JSON.stringify({ name: "Tesco 希腊酸奶", per_100g: { kcal: 120, protein: 5, fat: 0, carb: 9 },
    portions: [{ label: "整盒", grams: 500 }, { label: "一份", grams: 150 }], default_portion: "一份",
    pack_grams: 500, pack_kcal: 600, note: "蛋白脂肪实读", read: { kcal: true, protein: true, fat: false, carb: true },
    search: "Tesco Greek Style Yogurt 500g", barcode: null }),
  web: JSON.stringify({ found: true, matched_name: "Tesco Greek Style Natural Yogurt 500G",
    per_100g: { kcal: 120, protein: 5, fat: 9.6, carb: 3.9, fiber: 0 }, pack_grams: 500, source: "https://www.tesco.com/x" }),
  off: { status: 1, product: { code: "5057753936686", product_name: "Seeded Batch Loaf", brands: "Tesco",
    product_quantity: 800, product_quantity_unit: "g", serving_quantity: 44, nutrition_data_per: "100g",
    nutriments: { "energy-kcal_100g": 263, proteins_100g: 10.4, fat_100g: 5.6, carbohydrates_100g: 40.1, fiber_100g: 6.2 } } },
};

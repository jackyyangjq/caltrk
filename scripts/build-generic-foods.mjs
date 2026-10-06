// Builds data/generic-foods.json from the curated selection (scripts/generic-foods/*.json: which USDA foods,
// Chinese names, aliases, portions) joined with nutrition values from USDA SR Legacy (via the tempo-food-db
// package, rows with source = usda_sr_legacy). Nutrition numbers come only from the dataset, never from the selection.
// Usage: node scripts/build-generic-foods.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataset = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve("tempo-food-db/package.json")), "data/tempolife-foods.json"), "utf8"));
const usda = new Map(dataset.filter(r => r.source === "usda_sr_legacy").map(r => [r.name, r]));

const dir = path.join(ROOT, "scripts/generic-foods");
const sel = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

function fnv(s) { let h = 0x811c9dc5; for (const c of Buffer.from(s, "utf8")) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
const r1 = x => Math.round((x || 0) * 10) / 10;
const out = [], problems = [], seen = new Set(), names = new Set();
for (const s of sel) {
  const r = usda.get(s.src);
  if (!r) { problems.push("not in USDA data: " + s.src); continue; }
  if (seen.has(s.src)) { problems.push("duplicate: " + s.src); continue; }
  if (names.has(s.zh)) problems.push("duplicate Chinese name: " + s.zh);
  seen.add(s.src); names.add(s.zh);
  const portions = (s.portions || []).filter(p => p && p.label && p.grams > 0 && p.grams <= 2000).map(p => ({ label: String(p.label), grams: Math.round(p.grams) }));
  if (!portions.some(p => p.grams === 100)) portions.push({ label: "100 g", grams: 100 });
  const def = portions.some(p => p.label === s.default) ? s.default : portions[0].label;
  const fiber = r1(r.fiber_g);
  out.push({
    id: "g-" + fnv(s.src),
    name: s.zh,
    aka: [...new Set((s.aliases || []).map(a => String(a).trim()).filter(Boolean))].join("|"),
    en: s.src,
    /* 美国口径的碳水含膳食纤维；减掉纤维，换成和英国标签一样的口径（热量不变） */
    per_100g: { kcal: Math.round(r.kcal_per_100g), protein: r1(r.protein_g), fat: r1(r.fat_g), carb: r1(Math.max(0, (r.carbs_g || 0) - (r.fiber_g || 0))) },
    fiber,
    portions, default_portion: def,
  });
}
const ids = new Set(out.map(f => f.id));
if (ids.size !== out.length) problems.push("id collision");
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data/generic-foods.json"), JSON.stringify({
  source: "USDA FoodData Central, SR Legacy (2018), public domain; compiled via tempo-food-db (TempoLife, CC-BY-4.0)",
  carb_note: "carb = USDA carbohydrate by difference minus dietary fibre (UK label convention)",
  foods: out,
}) + "\n");
console.log(`${out.length} foods written to data/generic-foods.json (${fs.statSync(path.join(ROOT, "data/generic-foods.json")).size} bytes)`);
if (problems.length) { console.log(problems.join("\n")); process.exitCode = 1; }

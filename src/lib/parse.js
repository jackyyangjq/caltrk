import { atwaterWarn } from "./checks.js";
import { MAX_G } from "./util.js";

export function webParse(txt) {
  var s = String(txt).replace(/```json|```/g, "");
  var a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  var o; try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  if (!o || o.found !== true || !o.per_100g) return null;
  function num(x, hi) { x = Number(x); return (isFinite(x) && x >= 0 && x <= hi) ? Math.round(x * 10) / 10 : null; }
  var per = { kcal: num(o.per_100g.kcal, 900), protein: num(o.per_100g.protein, 100), fat: num(o.per_100g.fat, 100), carb: num(o.per_100g.carb, 100) };
  if (per.kcal == null || per.protein == null || per.fat == null || per.carb == null) return null;
  per.kcal = Math.round(per.kcal);
  return { per_100g: per, fiber: num(o.per_100g.fiber, 100) || 0,
           src: (String(o.matched_name || "").slice(0, 40) + " " + String(o.source || "").slice(0, 80)).trim() };
}

export function aiParseFood(txt) {
  var s = String(txt).replace(/```json|```/g, "").trim();
  var a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  var o;
  try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  if (!o || typeof o.name !== "string" || !o.per_100g) return null;
  function num(x, lo, hi) { x = Number(x); return (isFinite(x) && x >= lo && x <= hi) ? Math.round(x * 10) / 10 : null; }
  var kcal = num(o.per_100g.kcal, 0, 900), pr = num(o.per_100g.protein, 0, 100),
      ft = num(o.per_100g.fat, 0, 100), cb = num(o.per_100g.carb, 0, 100);
  if (kcal == null || pr == null || ft == null || cb == null) return null;
  var ports = Array.isArray(o.portions) ? o.portions.filter(function (x) {
    return x && typeof x.label === "string" && Number(x.grams) > 0 && Number(x.grams) <= 2000;
  }).slice(0, 3).map(function (x) { return { label: String(x.label).slice(0, 12), grams: Math.round(Number(x.grams)) }; }) : [];
  if (!ports.length) ports = [{ label: "100 g", grams: 100 }];
  var dp = ports.some(function (x) { return x.label === o.default_portion; }) ? o.default_portion : ports[0].label;
  function optNum(x, lo, hi) { x = Number(x); return (isFinite(x) && x >= lo && x <= hi) ? x : null; }
  return { name: o.name.slice(0, 30), per_100g: { kcal: Math.round(kcal), protein: pr, fat: ft, carb: cb },
           portions: ports, default_portion: dp, note: String(o.note || "").slice(0, 120),
           pack_grams: optNum(o.pack_grams, 1, 5000), pack_kcal: optNum(o.pack_kcal, 1, 10000),
           unread: ["kcal", "protein", "fat", "carb"].filter(function (k) { return !(o.read && o.read[k] === true); }),
           search: String(o.search || "").replace(/\s+/g, " ").trim().slice(0, 120),
           barcode: /^\d{8,14}$/.test(String(o.barcode || "").replace(/\s/g, "")) ? String(o.barcode).replace(/\s/g, "") : null };
}

/* 一餐估算：解析 → 确认面板（可改名字/克数）→ 确认后写入流水 */
export function aiParseMeal(txt) {
  var s = String(txt).replace(/```json|```/g, "").trim();
  var a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  var o;
  try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  if (!o || !Array.isArray(o.items)) return null;
  function num(x, lo, hi) { x = Number(x); return (isFinite(x) && x >= lo && x <= hi) ? x : null; }
  var items = [];
  for (var i = 0; i < o.items.length && items.length < 8; i++) {
    var it = o.items[i];
    if (!it || typeof it.name !== "string" || !it.per_100g) continue;
    var g = num(it.grams, 1, 2000);
    var kcal = num(it.per_100g.kcal, 0, 900);
    if (g == null || kcal == null) continue;
    function m(x) { var v = num(x, 0, 100); return v == null ? 0 : Math.round(v * 10) / 10; }
    items.push({ name: it.name.slice(0, 30), grams: Math.round(g),
      per_100g: { kcal: Math.round(kcal), protein: m(it.per_100g.protein), fat: m(it.per_100g.fat), carb: m(it.per_100g.carb) } });
  }
  if (!items.length) return null;
  var note = String(o.note || "").slice(0, 160);
  var mealWarns = [];
  items.forEach(function (it) {
    var w = atwaterWarn(it.per_100g, it.name + " ");
    if (w) mealWarns.push(w);
  });
  if (mealWarns.length) note += "；⚠ " + mealWarns.join("；");
  return { items: items, note: note.slice(0, 300) };
}

/* 12 位的 UPC-A 补 0 成 EAN-13，本地比对和查询都用同一种写法 */
export function normBarcode(t) {
  var d = String(t || "").replace(/\D/g, "");
  return d.length === 12 ? "0" + d : d;
}
/* 条形码最后一位是校验位：手输时用来抓输错的一位 */
export function gtinValid(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  var sum = 0, n = code.length;
  for (var i = 0; i < n - 1; i++) sum += Number(code[n - 2 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - sum % 10) % 10 === Number(code[n - 1]);
}

export var OFF_FIELDS = "code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,product_quantity_unit," +
  "serving_size,serving_quantity,nutriments,nutrition_data_per";
export function offName(p, code) {
  var brand = String(p.brands || "").split(",")[0].trim();
  var nm = String(p.product_name_en || p.product_name || p.generic_name || "").trim();
  if (brand && nm.toLowerCase().indexOf(brand.toLowerCase()) < 0) nm = brand + " " + nm;
  return (nm || "条形码 " + code).replace(/\s+/g, " ").slice(0, 40);
}
/* Open Food Facts 的一条商品 → 本页的食物格式；没有热量就当查不到 */
export function offToSpec(p, code) {
  var n = p.nutriments || {}, sq = Number(p.serving_quantity);
  function val(k) {
    var v = n[k + "_100g"];
    if ((v === "" || v == null) && sq > 0 && n[k + "_serving"] != null && n[k + "_serving"] !== "") v = Number(n[k + "_serving"]) * 100 / sq;
    v = Number(v);
    return (v === v && isFinite(v) && v >= 0) ? v : null;   /* v === v 排除 NaN */
  }
  var kcal = val("energy-kcal");
  if (kcal == null) { var kj = val("energy-kj"); if (kj == null) kj = val("energy"); if (kj != null) kcal = kj / 4.184; }
  if (kcal == null || kcal > 900) return null;
  var r1 = function (x) { return x == null ? null : Math.round(x * 10) / 10; };
  var per = { kcal: Math.round(kcal), protein: r1(val("proteins")), fat: r1(val("fat")), carb: r1(val("carbohydrates")) };
  var extra = { fiber: r1(val("fiber")), polyols: r1(val("polyols")), alcohol: r1(val("alcohol")) };
  var ml = /ml/i.test(String(p.product_quantity_unit || "") + String(p.nutrition_data_per || ""));
  var ports = [], pq = Number(p.product_quantity), u = ml ? "ml" : "g";
  if (sq > 0 && sq <= MAX_G) ports.push({ label: "一份（标签）" + Math.round(sq) + u, grams: Math.round(sq) });
  if (pq > 0 && pq <= MAX_G && Math.round(pq) !== Math.round(sq)) ports.push({ label: "整包 " + Math.round(pq) + u, grams: Math.round(pq) });
  if (!ports.some(function (x) { return x.grams === 100; })) ports.push({ label: "100 " + u, grams: 100 });
  var dp = ports[0].label;
  if (!(sq > 0) && !(pq > 0 && pq <= 500)) dp = "100 " + u;
  return { code: code, name: offName(p, code), per_100g: per, extra: extra, portions: ports, default_portion: dp, ml: ml };
}

/* 库里可能已有同一样东西（名字里的英文词对得上），给他一键改用库里那条 */
export function scanTokens(s) {
  var stop = { and: 1, with: 1, the: 1, for: 1, from: 1, pack: 1, free: 1 };
  var out = {};
  (String(s).toLowerCase().match(/[a-z]{3,}/g) || []).forEach(function (w) { w = w.replace(/s$/, ""); if (!stop[w]) out[w] = 1; });
  return Object.keys(out);
}

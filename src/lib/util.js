/* ── 小工具 ─────────────────────────────────────────────── */
export function pad2(n) { return (n < 10 ? "0" : "") + n; }
export function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
export function nowTs() { var d = new Date(); return todayStr() + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
export function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function kcalOf(food, grams) { return Math.round(food.per_100g.kcal * grams / 100); }
export function protOf(food, grams) { return Math.round(food.per_100g.protein * grams / 100 * 10) / 10; }

export function mealOf(ts) {
  var h = parseInt(ts.slice(11, 13), 10);
  if (h < 11) return "早餐";
  if (h < 16) return "午餐";
  if (h < 22) return "晚餐";
  return "夜宵";
}
export var MEAL_ORDER = ["早餐", "午餐", "晚餐", "夜宵"];

export var WD_CN = ["日", "一", "二", "三", "四", "五", "六"];
export function weekdayOf(date) { return "周" + WD_CN[new Date(date + "T12:00").getDay()]; }
export function dayLabel(date) { return date.slice(5).replace("-", "/") + " " + weekdayOf(date); }

export function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export var MAX_G = 5000, MAX_KCAL = 5000;

export function normName(x) { return String(x || "").replace(/\s+/g, "").toLowerCase(); }

export function daysBetween(fromDate, toDate) {
  return Math.round((new Date(toDate + "T12:00") - new Date(fromDate + "T12:00")) / 86400000);
}

export function dayTotals(entries) {
  var t = { intake: 0, prot: 0, fat: 0, carb: 0, hasGuess: false };
  entries.forEach(function (e) {
    t.intake += e.kcal || 0; t.prot += e.protein || 0;
    t.fat += e.fat || 0; t.carb += e.carb || 0;
    if (e.pending || e.confidence === "guess") t.hasGuess = true;
  });
  t.prot = Math.round(t.prot * 10) / 10; t.fat = Math.round(t.fat * 10) / 10; t.carb = Math.round(t.carb * 10) / 10;
  return t;
}
export function dateShift(dateStr, n) {
  var x = new Date(dateStr + "T12:00"); x.setDate(x.getDate() + n);
  return x.getFullYear() + "-" + pad2(x.getMonth() + 1) + "-" + pad2(x.getDate());
}

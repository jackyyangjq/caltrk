import { FOOD_LIBRARY, UF_FIX, UF_SAME_AS } from "./data/foods.js";
import { LOG_FIX } from "./data/logfix.js";
import { genericById } from "./generic.js";
import { applyLogFixesTo } from "./lib/logfix.js";

/* ── 存储（键名一经发布不得更改，设计 §4.6）──────────────── */
export var K = {
  log: "caltrk7f3a.log.v1",
  weight: "caltrk7f3a.weight.v1",
  days: "caltrk7f3a.days.v1",
  settings: "caltrk7f3a.settings.v1",
  training: "caltrk7f3a.training.v1"   /* 2026-09-01 新增键（原有四个键名不动） */
};
export var storeBroken = false;   // 读损坏或写失败：页面顶部常驻警告，且暂停「切回时重读」

/* 解析失败时先把原始字符串抢救到 .bak 键（只增键，不动原键名），再返回空值。
   直接返回空值会让下一次写入把还可能人工修复的原始数据整体抹掉。 */
export function loadArr(key) {
  var raw = localStorage.getItem(key);
  if (raw == null) return [];
  try {
    var v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch (e) {}
  try { localStorage.setItem(key + ".bak", raw); } catch (e2) {}
  storeBroken = true;
  return [];
}
export function loadObj(key) {
  var raw = localStorage.getItem(key);
  if (raw == null) return {};
  try {
    var v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch (e) {}
  try { localStorage.setItem(key + ".bak", raw); } catch (e2) {}
  storeBroken = true;
  return {};
}
export var DB = {};
export function reloadDB() {
  DB.log = loadArr(K.log);
  DB.weight = loadArr(K.weight);
  DB.days = loadArr(K.days);
  DB.settings = loadObj(K.settings);
  DB.training = loadArr(K.training);
  applyLogFixes();
}
reloadDB();
export function persist(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (e) { storeBroken = true; alert("本地存储写入失败，这条记录可能没有保存住。请截图并尽快导出。"); }
}

export function applyLogFixes() {
  if (storeBroken) return;
  var done = Array.isArray(DB.settings.log_fix_done) ? DB.settings.log_fix_done : [];
  if (applyLogFixesTo(DB.log, done, LOG_FIX)) {
    DB.settings.log_fix_done = done;
    persist(K.log, DB.log);
    persist(K.settings, DB.settings);
  }
}

export var UF_KEY = "caltrk7f3a.userfoods.v1";   // 手机上拍照入库的个人食物，随导出带出

export var USER_FOODS = loadArr(UF_KEY);

/* 个人食物一律经这里取用：UF_FIX 的修正就地盖上去，localStorage 里的原条目不动 */
export function ufView(f) {
  var fx = UF_FIX[f.id], o = {
    id: f.id, name: f.name, per_100g: f.per_100g, portions: f.portions,
    default_portion: f.default_portion, confidence: f.confidence, note: f.note, added: f.added
  };
  if (fx) {
    for (var k in fx) if (fx.hasOwnProperty(k) && k !== "why") o[k] = fx[k];
    o.fix_why = fx.why;
  }
  if (o.note) o.note = String(o.note).replace(/^(AI 识别：)+/, "AI 识别：");  /* 老条目前缀加了两遍 */
  return o;
}
export function allFoodsRaw() { return FOOD_LIBRARY.concat(USER_FOODS.map(ufView)); }
/* 搜索、快速记录、食物库都用这个：与正式条目重复的个人条目只留正式那一条 */
export function allFoods() { return allFoodsRaw().filter(function (f) { return !UF_SAME_AS[f.id]; }); }

/* 用全量：老流水引用的退役条目也要能查到，否则编辑旧记录会掉进「找不到来源」的兜底面板 */
export function foodById(id) {
  var all = allFoodsRaw();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return genericById(id);   /* 通用食物库（下载好之后才有） */
}

export function entriesOn(date) {
  return DB.log.filter(function (e) { return e.ts && e.ts.slice(0, 10) === date; });
}

export function dayComplete(date) {
  for (var i = 0; i < DB.days.length; i++) if (DB.days[i].date === date) return !!DB.days[i].complete;
  return false;
}
export function setDayComplete(date, val) {
  for (var i = 0; i < DB.days.length; i++) {
    if (DB.days[i].date === date) { DB.days[i].complete = val; persist(K.days, DB.days); return; }
  }
  DB.days.push({ date: date, complete: val });
  persist(K.days, DB.days);
}
/* 最后一次记这样东西用了多少克。重复/转正的条目按 UF_SAME_AS 归并，
   否则换了 id 之后「上次克数」会突然找不到 */
export function lastGramsOf(foodId) {
  for (var i = DB.log.length - 1; i >= 0; i--) {
    var e = DB.log[i];
    if (!e.food_id || !(e.grams > 0)) continue;
    if ((UF_SAME_AS[e.food_id] || e.food_id) === foodId) return e.grams;
  }
  return null;
}
export function setUserFoods(a) { USER_FOODS = a; }

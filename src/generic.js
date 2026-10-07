/* ── 通用食物库（v2.2）──────────────────────────────────────
   约 500 种常见食物（生鲜、主食、肉蛋奶、水果、常见菜和饮料），数值来自 USDA SR Legacy
   （美国农业部食物成分库，公有领域），中文名、别名和常用份量是整理时加的。
   文件 data/generic-foods.json 由 scripts/build-generic-foods.mjs 生成，页面打开后在后台下载，
   搜索时和「食物库 / 我的食物」分开列。记进流水后照常有 food_id，翻旧记录也能找到。
   这些是同类食物的平均值，误差和「通用成分表」一样按 20–30% 看（显示为浅色点）。 */
export var GENERIC = null;          /* 下载好之前是 null */
var GENERIC_BY_ID = {};
var loading = null;

export function loadGeneric() {
  if (loading) return loading;
  loading = fetch(new URL("data/generic-foods.json", location.href).href).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (j) {
    GENERIC = (j.foods || []).map(function (f) {
      f.confidence = "low";
      f.src = "generic";
      f.note = "通用食物库（USDA SR Legacy）：" + f.en + "。同类食物的平均值，误差按 20–30% 看；碳水已按英国标签口径扣除纤维" +
        (f.fiber ? "（纤维 " + f.fiber + " g/100g）" : "") + "。";
      GENERIC_BY_ID[f.id] = f;
      return f;
    });
    return GENERIC;
  });
  loading.catch(function () { loading = null; });   /* 没网就下次再试 */
  return loading;
}

export function genericById(id) { return GENERIC_BY_ID[id] || null; }

/* 吃过的通用食物（快速记录、「最近吃过」要能排进去） */
export function eatenGeneric(u) {
  return GENERIC ? GENERIC.filter(function (f) { return !!u.last[f.id]; }) : [];
}

/* 匹配打分：名字完全一样 / 某个别名完全一样 < 名字开头 < 名字包含 < 别名包含 < 英文名包含；同分短名字在前 */
export function matchScore(f, q) {
  var name = f.name.toLowerCase(), aka = (f.aka || "").toLowerCase(), en = (f.en || "").toLowerCase();
  if (name === q || ("|" + aka + "|").indexOf("|" + q + "|") >= 0) return 0;   /* aka 是用 | 隔开的别名 */
  if (name.indexOf(q) === 0) return 1;
  if (name.indexOf(q) >= 0) return 2;
  if (aka.indexOf(q) >= 0) return 3;
  if (en.indexOf(q) >= 0) return 4;
  return -1;
}
export function searchGeneric(query, n, u) {
  var q = String(query || "").trim().toLowerCase();
  if (!GENERIC || !q) return [];
  return GENERIC.map(function (f) { return { f: f, s: matchScore(f, q) }; })
    .filter(function (x) { return x.s >= 0; })
    .sort(function (a, b) {
      var ea = u && u.last[a.f.id] ? 0 : 1, eb = u && u.last[b.f.id] ? 0 : 1;
      return ea - eb || a.s - b.s || a.f.name.length - b.f.name.length;
    })
    .slice(0, n || 12).map(function (x) { return x.f; });
}

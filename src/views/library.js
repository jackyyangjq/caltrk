import { esc } from "../lib/util.js";
import { USER_FOODS, allFoods } from "../store.js";
import { addedCmp, agoLabel, recentCmp, usageStats } from "./today.js";


/* ── 食物库页 ───────────────────────────────────────────────
   排序 = 最近吃过的在最上面（带「今天 / 3 天前」），其余按入库时间倒序。
   「最近吃过」最多列 LIB_RECENT_MAX 条，排不上的照常出现在下面两栏里。 */
export var LIB_RECENT_MAX = 20;
export var libQuery = "";
export var elLib = document.getElementById("in-lib");
export var libComposing = false;
export function renderLibrary() {
  var el = document.getElementById("lib-body");
  var q = libQuery.toLowerCase();
  function match(f) { return !q || f.name.toLowerCase().indexOf(q) >= 0; }
  function row(f, ago) {
    return '<button class="r-item" data-act="open-food" data-food="' + f.id + '">' +
      '<span class="nm"><i class="dot ' + (f.confidence === "high" ? "hi" : "lo") + '"></i><span>' + esc(f.name) + '</span></span>' +
      '<span class="kc">' + (ago ? esc(ago) + ' · ' : '') + f.per_100g.kcal + ' /100g</span></button>';
  }
  var mineIds = {};
  USER_FOODS.forEach(function (f) { mineIds[f.id] = 1; });
  /* 个人食物带删除按钮：删的是手机上的条目，已记进流水的不受影响 */
  function line(f, ago) {
    if (!mineIds[f.id]) return row(f, ago);
    return '<div class="uf-row">' + row(f, ago) +
      '<button class="uf-del" data-act="del-userfood" data-food="' + f.id + '">删除</button></div>';
  }
  var u = usageStats();
  var list = allFoods().filter(match);
  var eaten = list.filter(function (f) { return u.last[f.id]; }).sort(recentCmp(u)).slice(0, LIB_RECENT_MAX);
  var top = {};
  eaten.forEach(function (f) { top[f.id] = 1; });
  /* 「最近吃过」之外的一律按入库顺序，新的在上；吃过的仍带上次记录的日期 */
  var rest = list.filter(function (f) { return !top[f.id]; }).sort(addedCmp());
  function ago(f) { return u.last[f.id] ? agoLabel(u.last[f.id]) : null; }
  var mine = rest.filter(function (f) { return mineIds[f.id]; });
  var lib = rest.filter(function (f) { return !mineIds[f.id]; });
  var h = "";
  if (eaten.length) {
    h += '<div class="mod-title" style="padding:2px 0 4px">最近吃过</div>' +
      eaten.map(function (f) { return line(f, agoLabel(u.last[f.id])); }).join("");
  }
  if (mine.length) {
    h += '<div class="mod-title" style="padding:14px 0 4px">我的食物（手机上 AI 入库）</div>' +
      mine.map(function (f) { return line(f, ago(f)); }).join("");
  }
  if (lib.length) {
    h += '<div class="mod-title" style="padding:14px 0 4px">食物库</div>' +
      lib.map(function (f) { return row(f, ago(f)); }).join("");
  }
  el.innerHTML = h || '<div class="empty">没有匹配的食物。</div>';
}
elLib.addEventListener("compositionstart", function () { libComposing = true; });
elLib.addEventListener("compositionend", function () { libComposing = false; libQuery = elLib.value; renderLibrary(); });
elLib.addEventListener("input", function () { if (libComposing) return; libQuery = elLib.value; renderLibrary(); });

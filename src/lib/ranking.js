import { daysBetween, mealOf } from "./util.js";

/* ── 「最近吃的排前面」的纯计算部分（今日页、搜索、食物库共用）──
   last  = 每样东西最后一次记录的时间，用来排序和显示「3 天前」；
   score = 快速记录用的常吃度，近 7 天的一次约等于 30 天前的三次，
           再给同一餐段（早/午/晚/夜宵）吃过的加权。 */
export function agoLabelAt(ts, today) {
  var d = daysBetween(ts.slice(0, 10), today);
  if (d <= 0) return "今天";
  if (d === 1) return "昨天";
  if (d < 14) return d + " 天前";
  return ts.slice(5, 7) + "/" + ts.slice(8, 10);
}
/* sameAs：重复/转正的条目，历史都并到留下的那一条上，否则蛋白粉这种天天记的会掉出快速记录 */
export function usageStatsOf(log, sameAs, today, slot) {
  var last = {}, score = {};
  log.forEach(function (e) {
    if (!e.food_id || !e.ts) return;
    var key = sameAs[e.food_id] || e.food_id;
    if (!last[key] || e.ts > last[key]) last[key] = e.ts;
    var d = daysBetween(e.ts.slice(0, 10), today);
    var w = d <= 6 ? 3 : (d <= 13 ? 2 : (d <= 29 ? 1 : 0.4));
    if (mealOf(e.ts) === slot) w *= 1.6;
    score[key] = (score[key] || 0) + w;
  });
  return { last: last, score: score };
}
/* 入库顺序：自己拍的在前（按入库日期），库里的在后（按加入顺序），都是新的在上 */
export function addedCmpOf(library) {
  var idx = {};
  library.forEach(function (f, i) { idx[f.id] = i; });
  return function (a, b) {
    var pa = a.added ? 0 : 1, pb = b.added ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (a.added && b.added && a.added !== b.added) return a.added < b.added ? 1 : -1;
    return (idx[b.id] == null ? -1 : idx[b.id]) - (idx[a.id] == null ? -1 : idx[a.id]);
  };
}
/* 吃过的按最后一次记录倒序排前面，没吃过的按入库顺序跟在后面 */
export function recentCmpOf(u, library) {
  var by = addedCmpOf(library);
  return function (a, b) {
    var la = u.last[a.id] || "", lb = u.last[b.id] || "";
    if (la !== lb) return la < lb ? 1 : -1;
    return by(a, b);
  };
}
/* 快速记录的候选：常吃度高的在前，同分按最近吃过 */
export function rankChips(foods, u, library, n) {
  var cmp = recentCmpOf(u, library), lib = foods.slice();
  lib.sort(function (a, b) {
    var d = (u.score[b.id] || 0) - (u.score[a.id] || 0);
    return d !== 0 ? d : cmp(a, b);
  });
  return lib.slice(0, n || 6);
}

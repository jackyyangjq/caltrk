/* ── 快速记录选谁（v2.4，用户要求）的纯计算部分（tests/unit/quick.test.js 覆盖）──
   冰箱里有什么只有他自己知道，所以由他决定：
     pins   = 他加的，新加的在前，全部显示；
     hidden = 他移除过的（比如吃完了），自动补位不再选它，直到他自己再加回来；
   他加的不满 QUICK_N 个时，用常吃度排在前面、又没被移除过的补满。
   状态存在 DB.settings.quick = { pins: [id…], hidden: [id…] }，随导出带出。 */
export var QUICK_N = 8;

/* 周报会把重复的个人条目并到正式条目上（UF_SAME_AS）：他加的那条要跟着换成留下的那条，并去重 */
export function normQuick(q, sameAs) {
  function canon(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (id) {
      if (typeof id !== "string" || !id) return;
      var c = sameAs[id] || id;
      if (!seen[c]) { seen[c] = 1; out.push(c); }
    });
    return out;
  }
  var pins = canon(q && q.pins), pinned = {};
  pins.forEach(function (id) { pinned[id] = 1; });
  return { pins: pins, hidden: canon(q && q.hidden).filter(function (id) { return !pinned[id]; }) };
}
/* 加入：放到最前面，并从「移除过」里拿掉。返回新状态，不改原来的 */
export function pinQuick(q, id) {
  return {
    pins: [id].concat(q.pins.filter(function (x) { return x !== id; })),
    hidden: q.hidden.filter(function (x) { return x !== id; })
  };
}
/* 移除（他加的，或自动补上来的都一样）：不在快速记录里显示，补位也不再选它 */
export function dropQuick(q, id) {
  return {
    pins: q.pins.filter(function (x) { return x !== id; }),
    hidden: q.hidden.indexOf(id) >= 0 ? q.hidden.slice() : q.hidden.concat([id])
  };
}
export function isPinned(q, id) { return q.pins.indexOf(id) >= 0; }
/* 补位候选：去掉他加的和他移除过的；排序交给调用方（rankChips） */
export function autoPool(foods, q) {
  var skip = {};
  q.pins.concat(q.hidden).forEach(function (id) { skip[id] = 1; });
  return foods.filter(function (f) { return !skip[f.id]; });
}
export function autoCount(q, n) { return Math.max(0, (n || QUICK_N) - q.pins.length); }

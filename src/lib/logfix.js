import { LOG_FIX_FIELDS } from "../data/logfix.js";

/* 把 fixes（id → 更正）盖到流水上；done 是已改过的记账键，会被追加。返回有没有改动。 */
export function applyLogFixesTo(log, done, fixes) {
  var changed = false;
  log.forEach(function (e) {
    var fx = fixes[e.id];
    /* rev：同一条又改了一次（比如你补充了信息），用新的记账键，保证手机上已经改过一遍的也会再改 */
    var key = fx && fx.rev ? e.id + "#" + fx.rev : e.id;
    if (!fx || done.indexOf(key) >= 0) return;
    var orig = {};
    LOG_FIX_FIELDS.forEach(function (k) {
      if (fx.hasOwnProperty(k)) { orig[k] = e.hasOwnProperty(k) ? e[k] : null; e[k] = fx[k]; }
    });
    if (fx.food_id) orig.name_raw = e.name_raw || null;
    if (!e.orig) e.orig = orig;   /* 第二次改时保留最初那份原值 */
    e.fix_why = fx.why; e.fixed = "2026-09-27";
    done.push(key); changed = true;
  });
  return changed;
}

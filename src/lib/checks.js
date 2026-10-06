/* ── 免费的算术自检：抓「千焦当大卡」「每份当每100g」这两类最常见错 ── */
export function atwaterWarn(per, prefix) {
  var calc = 4 * per.protein + 4 * per.carb + 9 * per.fat;
  if (per.kcal >= 40 && calc > 0 && Math.abs(calc - per.kcal) / per.kcal > 0.3) {
    return prefix + "热量和碳蛋脂对不上（标 " + per.kcal + "，按碳蛋脂算约 " + Math.round(calc) + "）";
  }
  return null;
}
export function validateFoodSpec(spec) {
  var warns = [], oks = [];
  var aw = atwaterWarn(spec.per_100g, "每100g ");
  if (aw) warns.push(aw);
  if (spec.pack_grams > 0 && spec.pack_kcal > 0) {
    var calcPack = spec.per_100g.kcal * spec.pack_grams / 100;
    if (Math.abs(calcPack - spec.pack_kcal) / spec.pack_kcal > 0.12) {
      warns.push("整包交叉验证不一致（每100g×" + spec.pack_grams + "g≈" + Math.round(calcPack) +
        "，标签写 " + Math.round(spec.pack_kcal) + "）——可能把每份数值当成了每100g，建议对着标签核一遍再用");
    } else {
      oks.push("整包交叉验证一致");
    }
  } else {
    oks.push("标签无整包热量，未能交叉验证");
  }
  return { warns: warns, oks: oks };
}
export function compareSpecs(a, b) {
  var diffs = [];
  if (Math.abs(a.per_100g.kcal - b.per_100g.kcal) / Math.max(a.per_100g.kcal, 1) > 0.12) {
    diffs.push("kcal " + a.per_100g.kcal + " vs " + b.per_100g.kcal);
  }
  ["protein", "fat", "carb"].forEach(function (k) {
    var d = Math.abs(a.per_100g[k] - b.per_100g[k]);
    if (d > Math.max(2, a.per_100g[k] * 0.2)) diffs.push(k + " " + a.per_100g[k] + " vs " + b.per_100g[k]);
  });
  return diffs.length ? ["复核模型读数不同：" + diffs.join("、") + "——建议对着标签核一遍"] : [];
}

export function webCheck(per, fiber) {
  var calc = 4 * per.protein + 9 * per.fat + 4 * per.carb + 2 * (fiber || 0);
  return per.kcal < 20 || Math.abs(calc - per.kcal) <= Math.max(8, per.kcal * 0.1);
}

/* 算术核对：蛋白×4＋脂肪×9＋碳水×4＋纤维×2（英国标签碳水不含纤维；糖醇按 2.4、酒精按 7）对标称热量 */
export function scanChecks(per, extra) {
  var w = [];
  ["protein", "fat", "carb"].forEach(function (k) {
    if (per[k] == null) w.push({ protein: "蛋白质", fat: "脂肪", carb: "碳水" }[k] + "没有数据，照标签补上再存（空着按 0 算会压低当天数字）");
  });
  var P = per.protein || 0, F = per.fat || 0, C = per.carb || 0;
  var poly = Math.min(extra.polyols || 0, C);
  var calc = 4 * P + 9 * F + 4 * (C - poly) + 2.4 * poly + 2 * (extra.fiber || 0) + 7 * (extra.alcohol || 0);
  if (per.kcal >= 20 && Math.abs(calc - per.kcal) > Math.max(20, per.kcal * 0.15)) {
    w.push("热量和碳蛋脂对不上：标 " + per.kcal + " kcal，按碳蛋脂" + (extra.fiber ? "纤维" : "") + "算约 " + Math.round(calc) + "，可能有人录错了，对着包装核一下");
  }
  if (P + F + C > 105) w.push("三大营养素加起来超过 100 g，数据有误");
  return w;
}

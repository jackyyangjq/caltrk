import { dateShift, daysBetween } from "./util.js";

/* ── 体重趋势（v2.1）────────────────────────────────────────
   Hacker's Diet 的指数平滑：trend += α × (当天体重 − trend)，α = 0.1。
   只用晨重；没称的日子按前后两次线性插值补上再平滑，所以漏称几天趋势线也不跳。
   代价是滞后：大约反映 (1−α)/α ≈ 9 天前开始的变化，头两周的速度会偏保守。 */
export var TREND_ALPHA = 0.1;

/* 晨重按日期排好、每天一个（同一天有多条取最后一条） */
export function morningPoints(weights) {
  var by = {};
  weights.forEach(function (w) {
    if (w && w.context === "morning" && w.kg > 0 && w.date) by[w.date] = w.kg;
  });
  return Object.keys(by).sort().map(function (d) { return { date: d, kg: by[d] }; });
}

/* 从第一次晨称到最后一次，逐日给出 { date, kg（当天实称，没称为 null）, trend } */
export function dailyTrend(points, alpha) {
  var a = alpha == null ? TREND_ALPHA : alpha;
  if (!points.length) return [];
  var out = [{ date: points[0].date, kg: points[0].kg, trend: points[0].kg }];
  var t = points[0].kg;
  for (var i = 1; i < points.length; i++) {
    var p0 = points[i - 1], p1 = points[i], n = daysBetween(p0.date, p1.date);
    for (var k = 1; k <= n; k++) {
      var est = p0.kg + (p1.kg - p0.kg) * k / n;
      t += a * (est - t);
      out.push({ date: dateShift(p0.date, k), kg: k === n ? p1.kg : null, trend: t });
    }
  }
  return out;
}

/* 趋势线最近 days 天的变化，折成每周公斤数（负数 = 在掉）。数据不够返回 null。 */
export function trendRate(series, days) {
  var n = series.length;
  if (n <= days) return null;
  return (series[n - 1].trend - series[n - 1 - days].trend) / days * 7;
}

/* 每周掉多少 vs 计划区间 [lo, hi]（都是正数，单位 kg/周） */
export function rateVerdict(rate, plan) {
  if (rate == null) return null;
  var loss = -rate;
  if (loss < plan[0]) return "slow";
  if (loss > plan[1]) return "fast";
  return "on";
}

/* 刻度：给定区间取 3–6 个整齐的刻度 */
export function niceTicks(lo, hi, steps) {
  var span = hi - lo, cand = steps || [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  var step = cand[cand.length - 1];
  for (var i = 0; i < cand.length; i++) if (span / cand[i] <= 5) { step = cand[i]; break; }
  var out = [];
  for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100 || 0);
  return out;
}

import { BUILD } from "../build.js";
import { dailyTrend, morningPoints, niceTicks, rateVerdict, trendRate } from "../lib/trend.js";
import { dateShift, todayStr, weekdayOf } from "../lib/util.js";
import { DB, dayComplete } from "../store.js";

/* ── 体重页「趋势」卡（v2.1）──────────────────────────────────
   上下两块共用日期轴、各用各的纵轴（不做双纵轴）：
     上：晨重散点 + 平滑趋势线；下：每天摄入柱（没打「记全了」的画浅色）+ 目标/基准消耗两条参考线。
   点按或拖动图表看某一天的数；下面「按天看数字」是同样数据的表格。 */
export var trendRange = "30";
export function setTrendRange(r) { trendRange = r; }

var RANGES = [["14", "2 周"], ["30", "1 个月"], ["all", "全部"]];
var W_DEFAULT = 360;

function fmtKg(x) { return x == null ? "—" : x.toFixed(1); }
function fmtRate(r) { return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(2); }

/* 全部历史算趋势（窗口起点不影响平滑结果），再截出窗口里的日子 */
function trendData() {
  var today = todayStr();
  var series = dailyTrend(morningPoints(DB.weight));
  var byDate = {};
  series.forEach(function (s) { byDate[s.date] = s; });
  var intake = {};
  DB.log.forEach(function (e) {
    var d = (e.ts || "").slice(0, 10);
    if (d) intake[d] = (intake[d] || 0) + (e.kcal || 0);
  });
  var start;
  if (trendRange === "all") {
    start = series.length ? series[0].date : today;
    Object.keys(intake).forEach(function (d) { if (d < start) start = d; });
  } else start = dateShift(today, -(parseInt(trendRange, 10) - 1));
  var days = [];
  for (var d = start; d <= today; d = dateShift(d, 1)) {
    var s = byDate[d];
    days.push({ date: d, kg: s ? s.kg : null, trend: s ? s.trend : null,
                kcal: intake[d] != null ? Math.round(intake[d]) : null, complete: dayComplete(d) });
  }
  return { series: series, days: days };
}

function statsHtml(series) {
  var last = series.length ? series[series.length - 1] : null;
  var r7 = trendRate(series, 7), r14 = trendRate(series, 14);
  var plan = BUILD.plan_rate;
  var h = '<div class="split3">' +
    '<div><span class="k">趋势体重</span><span class="v">' + (last ? fmtKg(last.trend) + '<small> kg</small>' : "—") + '</span></div>' +
    '<div><span class="k">近 7 天</span><span class="v">' + (r7 == null ? "—" : fmtRate(r7) + '<small> kg/周</small>') + '</span></div>' +
    '<div><span class="k">近 14 天</span><span class="v">' + (r14 == null ? "—" : fmtRate(r14) + '<small> kg/周</small>') + '</span></div>' +
    '</div>';
  var r = r14 != null ? r14 : r7, span = r14 != null ? "最近两周" : "最近一周";
  var v = rateVerdict(r, plan), planTxt = "计划每周 " + plan[0] + "–" + plan[1] + " kg";
  var txt;
  if (!last) txt = "还没有晨重记录。早上起床、上完厕所、早饭前称一次，从第一次称起攒满 8 天就能算速度。";
  else if (v == null) txt = "从第一次晨称起攒满 8 天才算速度，现在是第 " + series.length + " 天。";
  else if (r >= 0) txt = span + "趋势在往上走，每周 <b>" + fmtRate(r) + " kg</b>（" + planTxt + "）。";
  else txt = span + "每周掉 <b>" + Math.abs(r).toFixed(2) + " kg</b>，" +
    (v === "on" ? "在计划区间内（" + planTxt + "）。" : (v === "slow" ? "比计划慢" : "比计划快") + "（" + planTxt + "）。");
  if (last && last.date !== todayStr()) txt += "最后一次晨称是 " + last.date.slice(5).replace("-", "/") + "。";
  return h + '<div class="verdict">' + txt + '</div>' +
    '<div class="hint">趋势线是平滑过的晨重，不跟着单日的水分、盐、排便起伏跳，代价是大约滞后一周。</div>';
}

/* 图表几何 */
function layout(W, n) {
  var g = { W: W, padL: 32, padR: 8, yA: 8, hA: 140, gap: 14, hB: 72 };
  g.yB = g.yA + g.hA + g.gap;
  g.H = g.yB + g.hB + 18;
  g.plotW = W - g.padL - g.padR;
  g.slot = g.plotW / Math.max(1, n);
  g.x = function (i) { return g.padL + g.slot * (i + 0.5); };
  return g;
}

function chartSvg(days, W) {
  var n = days.length, g = layout(W, n);
  var kgs = [];
  days.forEach(function (d) { if (d.kg != null) kgs.push(d.kg); if (d.trend != null) kgs.push(d.trend); });
  var h = '<svg class="trchart" id="trchart" viewBox="0 0 ' + W + ' ' + g.H + '" width="100%" tabindex="0" role="img" ' +
    'aria-label="晨重与趋势、每日摄入图，左右方向键逐日查看">';

  /* 上块：晨重 */
  if (kgs.length) {
    var lo = Math.min.apply(null, kgs) - 0.3, hi = Math.max.apply(null, kgs) + 0.3;
    if (hi - lo < 1.5) { var mid = (hi + lo) / 2; lo = mid - 0.75; hi = mid + 0.75; }
    var yk = function (kg) { return g.yA + g.hA * (hi - kg) / (hi - lo); };
    niceTicks(lo, hi, [0.5, 1, 2, 5]).forEach(function (t) {
      var y = yk(t).toFixed(1);
      h += '<line class="tr-grid" x1="' + g.padL + '" x2="' + (W - g.padR) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="tr-ax" x="' + (g.padL - 5) + '" y="' + y + '" dy="3.5" text-anchor="end">' + t.toFixed(t % 1 ? 1 : 0) + '</text>';
    });
    var path = "";
    days.forEach(function (d, i) {
      if (d.trend == null) return;
      path += (path ? "L" : "M") + g.x(i).toFixed(1) + " " + yk(d.trend).toFixed(1);
    });
    if (path) h += '<path class="tr-trend" d="' + path + '"/>';
    days.forEach(function (d, i) {
      if (d.kg != null) h += '<circle class="tr-dot" cx="' + g.x(i).toFixed(1) + '" cy="' + yk(d.kg).toFixed(1) + '" r="4"/>';
    });
    h += '<circle class="tr-hi" id="tr-hi" r="4.5" cx="-20" cy="-20"/>';
    g.yk = yk;
  } else {
    h += '<text class="tr-empty" x="' + (g.padL + g.plotW / 2) + '" y="' + (g.yA + g.hA / 2) + '" text-anchor="middle">这段时间没有晨重</text>';
  }

  /* 下块：每日摄入 */
  var kmax = Math.max(BUILD.tdee || 0, BUILD.kcal_target || 0, 1);
  days.forEach(function (d) { if (d.kcal > kmax) kmax = d.kcal; });
  kmax *= 1.08;
  var base = g.yB + g.hB;
  var yc = function (k) { return base - g.hB * k / kmax; };
  var bw = Math.min(24, Math.max(1.5, g.slot - 2));
  days.forEach(function (d, i) {
    if (!(d.kcal > 0)) return;
    var x0 = g.x(i) - bw / 2, y = yc(d.kcal), r = Math.min(4, bw / 2, base - y);
    h += '<path class="tr-bar' + (d.complete ? "" : " part") + '" d="M' + x0.toFixed(1) + ' ' + base + 'V' + (y + r).toFixed(1) +
      'Q' + x0.toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x0 + r).toFixed(1) + ' ' + y.toFixed(1) +
      'H' + (x0 + bw - r).toFixed(1) + 'Q' + (x0 + bw).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x0 + bw).toFixed(1) + ' ' + (y + r).toFixed(1) +
      'V' + base + 'Z"/>';
  });
  h += '<line class="tr-base" x1="' + g.padL + '" x2="' + (W - g.padR) + '" y1="' + base + '" y2="' + base + '"/>';
  [[BUILD.kcal_target, "目标 "], [BUILD.tdee, "基准消耗 "]].forEach(function (rl) {
    if (rl[0] == null) return;
    var y = yc(rl[0]).toFixed(1);
    h += '<line class="tr-ref" x1="' + g.padL + '" x2="' + (W - g.padR) + '" y1="' + y + '" y2="' + y + '"/>' +
      '<text class="tr-ax tr-reflab" x="' + (W - g.padR) + '" y="' + y + '" dy="-3" text-anchor="end">' + rl[1] + rl[0] + '</text>';
  });
  h += '<text class="tr-ax" x="' + (g.padL - 5) + '" y="' + base + '" dy="3.5" text-anchor="end">0</text>';

  /* 日期轴：约 4 个刻度 */
  var step = Math.max(1, Math.ceil(n / 4));
  for (var i = n - 1; i >= 0; i -= step) {
    var x = Math.min(W - g.padR - 14, Math.max(g.padL + 14, g.x(i)));
    h += '<text class="tr-ax" x="' + x.toFixed(1) + '" y="' + (base + 13) + '" text-anchor="middle">' + days[i].date.slice(5).replace("-", "/") + '</text>';
  }
  h += '<line class="tr-cross" id="tr-cross" x1="-20" x2="-20" y1="' + g.yA + '" y2="' + base + '"/>';
  return { svg: h + '</svg>', g: g };
}

function tableHtml(days) {
  var rows = days.slice().reverse().filter(function (d) { return d.kg != null || d.kcal != null; });
  if (!rows.length) return "";
  return '<details class="tr-table"><summary>按天看数字</summary><table><thead><tr><th>日期</th><th>晨重</th><th>趋势</th><th>摄入</th></tr></thead><tbody>' +
    rows.map(function (d) {
      return '<tr><td>' + d.date.slice(5) + ' ' + weekdayOf(d.date).slice(1) + '</td><td>' + fmtKg(d.kg) + '</td><td>' + fmtKg(d.trend) +
        '</td><td>' + (d.kcal == null ? "—" : d.kcal + (d.complete ? "" : " *")) + '</td></tr>';
    }).join("") + '</tbody></table><div class="hint">* 那天没打「记全了」，摄入可能不全。</div></details>';
}

var chartState = null;   /* 当前图表的几何与数据，供点按/拖动查值 */

export function renderTrendMod(width) {
  var td = trendData();
  var W = Math.max(280, Math.round(width || W_DEFAULT));
  var c = chartSvg(td.days, W);
  chartState = { days: td.days, g: c.g, sel: null };
  var h = '<div class="mod" id="trend-mod"><div class="mod-title">趋势</div>' +
    '<div class="seg c3">' + RANGES.map(function (r) {
      return '<button data-act="trend-range" data-r="' + r[0] + '" aria-pressed="' + (trendRange === r[0]) + '">' + r[1] + '</button>';
    }).join("") + '</div>' +
    statsHtml(td.series) +
    '<div class="tr-legend"><span><i class="k-dot"></i>晨重</span><span><i class="k-line"></i>趋势</span>' +
      '<span><i class="k-bar"></i>摄入</span><span><i class="k-bar part"></i>没打记全</span></div>' +
    '<div class="tr-read" id="tr-read" aria-live="polite"></div>' +
    c.svg + tableHtml(td.days) +
    '</div>';
  return h;
}

/* 选中某一天：十字线、趋势点高亮、读数行 */
function selectDay(i) {
  var st = chartState;
  if (!st || !st.days.length) return;
  i = Math.max(0, Math.min(st.days.length - 1, i));
  st.sel = i;
  var d = st.days[i], g = st.g, x = g.x(i).toFixed(1);
  var cross = document.getElementById("tr-cross"), hi = document.getElementById("tr-hi"), out = document.getElementById("tr-read");
  if (cross) { cross.setAttribute("x1", x); cross.setAttribute("x2", x); }
  if (hi) {
    var on = d.trend != null && g.yk;
    hi.setAttribute("cx", on ? x : -20);
    hi.setAttribute("cy", on ? g.yk(d.trend).toFixed(1) : -20);
  }
  if (!out) return;
  out.textContent = "";
  function item(key, val, label) {
    var s = document.createElement("span");
    if (key) { var k = document.createElement("i"); k.className = key; s.appendChild(k); }
    var b = document.createElement("b"); b.textContent = val; s.appendChild(b);
    s.appendChild(document.createTextNode(" " + label));
    out.appendChild(s);
  }
  item(null, d.date.slice(5).replace("-", "/"), weekdayOf(d.date));
  if (d.kg != null) item("k-dot", fmtKg(d.kg), "晨重");
  if (d.trend != null) item("k-line", fmtKg(d.trend), "趋势");
  if (d.kcal != null) item("k-bar" + (d.complete ? "" : " part"), String(d.kcal), "kcal" + (d.complete ? "" : "（没打记全）"));
  if (d.kg == null && d.kcal == null) out.appendChild(document.createTextNode("这天没称也没记"));
  else if (d.kg == null) out.appendChild(document.createTextNode("没晨称"));
}

export function bindTrendChart() {
  var svg = document.getElementById("trchart");
  var st = chartState;
  if (!svg || !st) return;
  /* 默认选最后一个有数的日子 */
  var last = st.days.length - 1;
  while (last > 0 && st.days[last].kg == null && st.days[last].kcal == null) last--;
  selectDay(last);
  function at(ev) {
    var r = svg.getBoundingClientRect();
    var x = (ev.clientX - r.left) * (st.g.W / r.width);
    selectDay(Math.floor((x - st.g.padL) / st.g.slot));
  }
  var down = false;
  svg.addEventListener("pointerdown", function (ev) { down = true; at(ev); });
  svg.addEventListener("pointermove", function (ev) { if (down || ev.pointerType === "mouse") at(ev); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { svg.addEventListener(t, function () { down = false; }); });
  svg.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      selectDay((st.sel == null ? last : st.sel) + (ev.key === "ArrowLeft" ? -1 : 1));
    }
  });
}


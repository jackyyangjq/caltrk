import { todayStr } from "../lib/util.js";
import { flashId, setFlash } from "../state.js";
import { DB, K, persist } from "../store.js";
import { bindTrendChart, renderTrendMod } from "./weightChart.js";


/* ── 体重页 ─────────────────────────────────────────────── */
export var CTX_LABEL = { morning: "早晨", gym_pre: "训练前", other: "其他" };
export var weightCtx = new Date().getHours() < 11 ? "morning" : "gym_pre";
export var weightCtxTouched = false;
export function setWeightCtx(v) { weightCtx = v; weightCtxTouched = true; }
export function weightOf(date, ctx) {
  return DB.weight.find(function (w) { return w.date === date && w.context === ctx; });
}
export function prevWeight(ctx, beforeDate) {
  var rows = DB.weight.filter(function (w) { return w.context === ctx && w.date < beforeDate; });
  rows.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return rows[0] || null;
}
export function renderWeight() {
  var el = document.getElementById("view-weight");
  var t = todayStr();
  /* 若当天该时机已有记录，段选自动对齐它，避免一按保存把时机标签改错 */
  if (!weightCtxTouched) {
    var anyToday = DB.weight.filter(function (w) { return w.date === t; });
    if (anyToday.length) weightCtx = anyToday[anyToday.length - 1].context || weightCtx;
  }
  var todayW = weightOf(t, weightCtx);
  var seed = todayW || prevWeight(weightCtx, "9999") || (DB.weight.length ? DB.weight[DB.weight.length - 1] : null);
  var seedVal = todayW ? todayW.kg : (seed ? seed.kg : "");
  var prev = prevWeight(weightCtx, t);

  var h = '<div class="mod"><div class="mod-title">记体重</div>' +
    '<div class="seg c3">' +
      '<button data-act="ctx-morning" aria-pressed="' + (weightCtx === "morning") + '">早晨 · 起床后</button>' +
      '<button data-act="ctx-gym" aria-pressed="' + (weightCtx === "gym_pre") + '">健身房 · 训练前</button>' +
      '<button data-act="ctx-other" aria-pressed="' + (weightCtx === "other") + '">其他</button>' +
    '</div>' +
    '<div class="kgrow">' +
      '<button data-act="kg-minus" aria-label="减 0.1 公斤">−0.1</button>' +
      '<input id="in-kg" type="number" inputmode="decimal" min="30" max="200" step="0.1" placeholder="kg"' +
        (seedVal !== "" ? ' value="' + seedVal + '"' : "") + '>' +
      '<button data-act="kg-plus" aria-label="加 0.1 公斤">+0.1</button>' +
    '</div>' +
    '<div class="kgdelta" id="kg-delta"></div>' +
    '<button class="btn solid" data-act="save-weight">' + (todayW ? "更新今天的" + CTX_LABEL[weightCtx] + "记录" : "保存") + '</button>' +
    '<div class="note">每天早晨固定时机称：起床、上完厕所、早饭前。健身房下午的测量选「健身房 · 训练前」，两条基线分析时分开处理，同一天可以各记一条。</div>' +
    '</div>';

  /* 趋势卡：图宽按卡片内宽（卡片左右各 15px 内边距 + 1px 边框） */
  h += renderTrendMod(el.clientWidth - 32);

  h += '<div class="mod"><div class="mod-title">最近记录</div>';
  if (!DB.weight.length) {
    h += '<div class="empty">还没有体重记录。明早起床、上完厕所、早饭前称一次，顺手记进来——每天同一时机，数据才可比。</div>';
  } else {
    var rows = DB.weight.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    }).slice(0, 14);
    h += '<div class="w-list">' + rows.map(function (w, i) {
      return '<div class="w-row' + (i === 0 && flashId === "weight" ? " flash" : "") + '"><span class="d">' + w.date + '</span>' +
        '<span class="c">' + (CTX_LABEL[w.context] || "其他") + '</span>' +
        '<span class="kg">' + w.kg.toFixed(1) + ' kg</span></div>';
    }).join("") + '</div>';
    var morningRows = DB.weight.filter(function (w) { return w.context === "morning"; });
    if (morningRows.length >= 3) {
      var recent = morningRows.slice(-7);
      var avg = recent.reduce(function (a, w) { return a + w.kg; }, 0) / recent.length;
      h += '<div class="rowline" style="padding-top:8px;border-top:1px solid var(--hair)">' +
        '<span class="k">早晨值近 ' + recent.length + ' 次平均</span>' +
        '<span class="v">' + (Math.round(avg * 10) / 10).toFixed(1) + ' kg</span></div>';
    }
  }
  h += '</div>' +
    '<div class="mod"><div class="mod-title">提醒</div>' +
    '<div class="note">网页没法主动响铃。想要每天准点提醒，在 iOS「提醒事项」App 建两条重复提醒：' +
    '<b>每天 08:00「称体重 + 记早餐」</b>、<b>每天 21:30「补记 + 开『记全了』」</b>。' +
    '页面打开时顶部的提示条会兜底提示当天漏了什么。</div></div>';
  el.innerHTML = h;
  bindTrendChart();
  setFlash(null);
  updateKgDelta();
  var ki = document.getElementById("in-kg");
  ki.addEventListener("input", updateKgDelta);
}
export function updateKgDelta() {
  var ki = document.getElementById("in-kg");
  var out = document.getElementById("kg-delta");
  if (!ki || !out) return;
  var v = parseFloat(ki.value);
  var prev = prevWeight(weightCtx, todayStr());
  if (!(v > 0) || !prev) { out.textContent = prev ? "" : "首次" + CTX_LABEL[weightCtx] + "记录"; return; }
  var d = Math.round((v - prev.kg) * 10) / 10;
  out.textContent = "比上次" + CTX_LABEL[weightCtx] + "（" + prev.date.slice(5) + "）" +
    (d === 0 ? "持平" : (d > 0 ? "+" : "−") + Math.abs(d).toFixed(1) + " kg");
}
export function stepKg(delta) {
  var ki = document.getElementById("in-kg");
  if (!ki) return;
  var v = parseFloat(ki.value);
  if (!(v > 0)) {
    var seed = prevWeight(weightCtx, "9999") || (DB.weight.length ? DB.weight[DB.weight.length - 1] : null);
    v = seed ? seed.kg : 80;
  }
  v = Math.min(200, Math.max(30, Math.round((v + delta) * 10) / 10));
  ki.value = v.toFixed(1);
  updateKgDelta();
}
export function saveWeight() {
  var ki = document.getElementById("in-kg");
  if (!ki) return;
  var kg = parseFloat(ki.value);
  if (!(kg >= 30 && kg <= 200)) { ki.classList.add("bad"); return; }
  kg = Math.round(kg * 10) / 10;
  var t = todayStr();
  var idx = DB.weight.findIndex(function (w) { return w.date === t && w.context === weightCtx; });
  var rec = { date: t, kg: kg, context: weightCtx };
  if (idx >= 0) DB.weight[idx] = rec; else DB.weight.push(rec);
  setFlash("weight");
  persist(K.weight, DB.weight);
  renderWeight();
}

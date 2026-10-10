import { AI, aiBusy, aiReady } from "../ai.js";
import { BUILD } from "../build.js";
import { COMBOS, FOOD_LIBRARY, UF_SAME_AS } from "../data/foods.js";
import { eatenGeneric, searchGeneric } from "../generic.js";
import { addedCmpOf, agoLabelAt, rankChips, recentCmpOf, usageStatsOf } from "../lib/ranking.js";
import { MEAL_ORDER, dateShift, dayLabel, dayTotals, esc, kcalOf, mealOf, nowTs, todayStr, weekdayOf } from "../lib/util.js";
import { comboKcal } from "../sheets.js";
import { entriesOfView, flashId, setFlash, syncTopbar, viewDate, viewingToday } from "../state.js";
import { DB, K, allFoods, dayComplete, entriesOn, lastGramsOf, persist, storeBroken } from "../store.js";
import { TRAINING_PRESETS, trainingKcal, trainingMin, trainingOfView, trainingOn } from "../training.js";
import { VOICE_MAX_S, voiceSt } from "../voice.js";


/* ── 今日页 ─────────────────────────────────────────────── */
export var searchQuery = "";
export var elSearch = document.getElementById("in-search");
export var elClear = document.getElementById("btn-clear");
export function clearSearch() {
  searchQuery = "";
  elSearch.value = "";
  elSearch.blur();
  elClear.style.display = "none";
}
/* 「最近吃的排前面」：食物库、搜索结果、快速记录共用，算法在 lib/ranking.js */
export function agoLabel(ts) { return agoLabelAt(ts, todayStr()); }
export function usageStats() { return usageStatsOf(DB.log, UF_SAME_AS, todayStr(), mealOf(nowTs())); }
export function addedCmp() { return addedCmpOf(FOOD_LIBRARY); }
export function recentCmp(u) { return recentCmpOf(u, FOOD_LIBRARY); }
export function chipCandidates(n) {
  var u = usageStats();
  return rankChips(allFoods().concat(eatenGeneric(u)), u, FOOD_LIBRARY, n);
}
/* 搜索结果里的一行（食物库、我的食物、通用库共用） */
function foodRow(f) {
  var dp = f.portions.find(function (p) { return p.label === f.default_portion; }) || f.portions[0];
  return '<button class="r-item" data-act="open-food" data-food="' + f.id + '">' +
    '<span class="nm"><i class="dot ' + (f.confidence === "high" ? "hi" : "lo") + '"></i><span>' + esc(f.name) + '</span></span>' +
    '<span class="kc">' + esc(dp.label) + ' · ' + kcalOf(f, dp.grams) + '</span></button>';
}
export function bannerDismissedToday(kind) {
  var d = DB.settings.banner_dismiss || {};
  return d[kind] === todayStr();
}
export function dismissBanner(kind) {
  if (!DB.settings.banner_dismiss) DB.settings.banner_dismiss = {};
  DB.settings.banner_dismiss[kind] = todayStr();
  persist(K.settings, DB.settings);
  renderBanner();
}
export function daysSinceExport() {
  var last = DB.settings.last_export_confirm;
  if (!last) return null;
  var ms = new Date().getTime() - new Date(last.slice(0, 10) + "T00:00:00").getTime();
  return Math.floor(ms / 86400000);
}
/* 提示条：同屏最多一条，按优先级取第一条命中 */
export function renderBanner() {
  var el = document.getElementById("banner");
  var hour = new Date().getHours();
  var t = todayStr();
  var html = "";
  if (!viewingToday()) {
    /* 模式提示：这天的记录、训练、记全都改的是 viewDate，别记串了 */
    html = '<button class="nudge past" data-act="back-today">正在看 ' + dayLabel(viewDate) +
      '（不是今天）<span>回到今天 →</span></button>';
    if (storeBroken) {
      html = '<button class="nudge alarm" data-act="go-export">⚠️ 数据存储异常——请立即导出备份<span>去导出 →</span></button>' + html;
    }
    el.innerHTML = html;
    el.style.display = "";
    return;
  }
  if (storeBroken) {
    html = '<button class="nudge alarm" data-act="go-export">⚠️ 数据存储异常——请立即导出备份<span>去导出 →</span></button>';
  } else if (!DB.log.length && !DB.weight.length) {
    html = '<button class="nudge" data-act="go-export">这里还没有记录。换过网址的话，去「导出」页从备份导入<span>去导入 →</span></button>';
  } else if (hour < 11 && !DB.weight.some(function (w) { return w.date === t; }) && !bannerDismissedToday("weight")) {
    html = '<button class="nudge" data-act="go-weight">今晨体重还没记<span style="display:flex;gap:8px;align-items:center">去记 →<span class="x" data-act="dismiss-banner" data-kind="weight">✕</span></span></button>';
  } else if (hour >= 20 && !dayComplete(t) && !bannerDismissedToday("evening")) {
    var msg = entriesOn(t).length ? "睡前确认：记全了就打开下面的开关" : "今天还没记任何一餐";
    html = '<button class="nudge" data-act="go-complete">' + msg + '<span class="x" data-act="dismiss-banner" data-kind="evening">✕</span></button>';
  } else {
    var ds = daysSinceExport();
    if ((ds == null ? (DB.log.length > 20) : ds > 7) && !bannerDismissedToday("export") && DB.log.length) {
      html = '<button class="nudge" data-act="go-export">' +
        (ds == null ? "还没导出过备份" : "已 " + ds + " 天没导出备份") +
        '<span style="display:flex;gap:8px;align-items:center">去导出 →<span class="x" data-act="dismiss-banner" data-kind="export">✕</span></span></button>';
    }
  }
  el.innerHTML = html;
  el.style.display = html ? "" : "none";
}

/* 近 7 天卡片：单日波动大，「有没有吃超」看周均才算数；晨重也看周均 */
export function renderWeekMod(today) {
  var byDay = {};
  DB.log.forEach(function (e) {
    var d = (e.ts || "").slice(0, 10);
    if (!d || d === today) return;
    byDay[d] = (byDay[d] || 0) + (e.kcal || 0);
  });
  var days = [], compl = 0;
  for (var i = 1; i <= 7; i++) {
    var d = dateShift(today, -i);
    if (byDay[d] != null) { days.push(byDay[d]); if (dayComplete(d)) compl++; }
  }
  var mw = DB.weight.filter(function (w) { return w.context === "morning" && w.kg > 0; });
  var thisW = mw.filter(function (w) { return w.date > dateShift(today, -7) && w.date <= today; });
  var prevW = mw.filter(function (w) { return w.date > dateShift(today, -14) && w.date <= dateShift(today, -7); });
  function avg(a, key) { return a.length ? a.reduce(function (s, x) { return s + (key ? x[key] : x); }, 0) / a.length : null; }
  var aI = avg(days), aW = avg(thisW, "kg"), pW = avg(prevW, "kg");
  if (aI == null && aW == null) return "";
  var h = '<div class="mod"><div class="mod-title">近 7 天</div>';
  if (aI != null) {
    var ai = Math.round(aI);
    var diff = BUILD.kcal_target != null ? ai - BUILD.kcal_target : null;
    h += '<div class="rowline"><span class="k">日均摄入</span><span class="v' + (diff > 0 ? " warn" : "") + '">' + ai + ' kcal' +
      (diff == null ? "" : (diff > 0 ? "（超目标 " + diff + "）" : "（低于目标 " + (-diff) + "）")) + '</span></div>' +
      '<div class="hint">' + days.length + ' 天有记录' + (compl ? '，' + compl + ' 天记全' : '') +
      (days.length < 4 ? '——不足 4 天，均值只能参考' : '') + '</div>';
  }
  if (aW != null) {
    var dw = pW != null ? Math.round((aW - pW) * 10) / 10 : null;
    h += '<div class="rowline" style="margin-top:6px"><span class="k">晨重均值</span><span class="v">' + aW.toFixed(1) + ' kg' +
      (dw == null ? "" : '（比上周 ' + (dw > 0 ? '+' : '') + dw.toFixed(1) + '）') + '</span></div>' +
      '<div class="hint">' + thisW.length + ' 次晨称' + (thisW.length < 3 ? '——少于 3 次，趋势不可靠' : '') + '</div>';
  }
  return h + '</div>';
}
export function renderTodayTop() {
  var el = document.getElementById("today-top");
  var intake = dayTotals(entriesOfView()).intake;
  var flash = flashId ? " flash" : "";
  var dayW = viewingToday() ? "今日" : viewDate.slice(5).replace("-", "/") + " ";   /* 日期后面留个空格：「09/13 流水」 */

  var h = "";
  if (BUILD.kcal_target == null) {
    h += '<div class="mod"><div class="mod-title">' + dayW + '已摄入</div>' +
      '<div class="figure"><span class="n' + (intake === 0 ? " zero" : flash) + '">' + intake + '</span><span class="u">kcal</span></div>' +
      '<div class="verdict">目标尚未设定：先如实记录、按平时吃法吃。攒满一周完整记录并导出后，周报会把每日目标定出来。</div></div>';
  } else {
    var remain = BUILD.kcal_target - intake;
    var pct = Math.min(100, Math.round(intake / BUILD.kcal_target * 100));
    var overCls = remain < 0 ? " over" : flash;
    var fill = remain < 0 ? "fill-over" : "fill-brass";
    h += '<div class="mod"><div class="mod-title">' + dayW + (remain < 0 ? "超出" : "剩余") + '</div>' +
      '<div class="figure"><span class="n' + overCls + '">' + Math.abs(remain) + '</span><span class="u">kcal</span></div>' +
      '<div class="bar"><i class="' + fill + '" style="width:' + pct + '%"></i></div>' +
      '<div class="split3">' +
        '<div><span class="k">摄入</span><span class="v">' + intake + '</span></div>' +
        '<div><span class="k">目标</span><span class="v">' + BUILD.kcal_target + '</span></div>' +
        '<div><span class="k">基准消耗*</span><span class="v">' + (BUILD.tdee == null ? "—" : BUILD.tdee) + '</span></div>' +
      '</div>' +
      '<div class="verdict">' + (BUILD.tdee == null ? "*基准消耗待校准。" :
        "若每天都像" + (viewingToday() ? "今天" : "这天") + "，约 <b>" + (intake <= BUILD.tdee ? "−" : "+") +
        (Math.round(Math.abs(BUILD.tdee - intake) * 7 / 7700 * 100) / 100) + " kg/周</b>。*基准消耗是校准出的常数，不是当日实测。") +
      '</div></div>';
  }
  h += renderWeekMod(todayStr());
  el.innerHTML = h;
}
export function renderAiMod() {
  var el = document.getElementById("ai-mod");
  var h = '<div class="mod"><div class="mod-title">AI 记录</div>';
  if (voiceSt) {
    var heard = voiceSt.final + voiceSt.interim;
    h += '<div class="voice-row"><span class="rec-dot"></span><span class="k">' + (voiceSt.t0 ? "在听" : "正在打开麦克风…") + '</span>' +
      '<span class="t" id="voice-t">0 秒 / ' + VOICE_MAX_S + '</span></div>' +
      '<div class="note" id="voice-heard">' + (heard ? esc(heard) : "…") + '</div>' +
      '<div class="ai-btns"><button class="btn solid" data-act="voice-stop">说完了</button>' +
      '<button class="btn plain" data-act="voice-cancel">取消</button></div>' +
      '<div class="hint">说吃了什么、大概多少，比如「一碗牛肉面，加了个卤蛋，还有半罐可乐」。手机先把话转成文字，再交给 AI 估算。</div>';
  } else if (aiReady() && aiBusy) {
    h += '<div class="ai-btns"><button class="btn" disabled>识别中…</button></div>' +
      '<div class="hint">AI 正在分析，一般半分钟内；没读全要上网查时会久一些。</div>';
  } else {
    /* 没填密钥也照样显示按钮（点了带去填密钥）：2026-09-28 换网址后密钥没了，按钮整个藏起来，他以为功能被删了 */
    h += '<div class="ai-btns">' +
      '<button class="btn solid" data-act="ai-meal-photo">🍽 拍这一餐</button>' +
      '<button class="btn" data-act="ai-label-photo">📷 拍成分表入库</button></div>' +
      '<div class="ai-text-row">' +
      '<button class="btn mic" data-act="ai-voice" aria-label="说一说这一餐">🎤</button>' +
      '<input id="ai-meal-text" type="text" placeholder="或文字描述这一餐…">' +
      '<button class="btn" data-act="ai-meal-text">估算</button></div>' +
      (aiReady()
        ? '<div class="hint">可多选照片（正面＋成分表算同一个）；选好照片才调用 AI；估算先确认再记录。🎤 是说一段话来估算；文字和语音估算的每样东西确认后会存进「我的食物」，下次直接点。</div>'
        : AI.oldKey
          ? '<div class="hint" style="color:var(--over)">AI 已经换成 Claude，原来的 ChatAnywhere 密钥用不了了。点上面任一按钮会带你去「导出」页填 Anthropic 密钥。</div>'
          : '<div class="hint" style="color:var(--over)">还没填 AI 密钥（换了网址或清过浏览器数据后要重新填）。点上面任一按钮会带你去「导出」页填。</div>');
  }
  el.innerHTML = h + '</div>';
}
export var CHIP_LAST_MIN_KCAL = 25;
export function renderQuickBody() {
  var el = document.getElementById("quick-body");
  var h = "";
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    var u = usageStats();
    var hits = allFoods().filter(function (f) { return f.name.toLowerCase().indexOf(q) >= 0 || f.id.indexOf(q) >= 0; });
    hits.sort(recentCmp(u));   /* 最近吃过的排最上面 */
    var gen = searchGeneric(searchQuery, 12, u);
    h += '<div class="results">';
    /* 输入的是一串 8–14 位数字：多半是手抄的条形码 */
    var qDigits = searchQuery.replace(/\s/g, "");
    if (/^\d{8,14}$/.test(qDigits)) h += '<button class="r-guess" data-act="scan-code" data-code="' + qDigits + '">▥ 按条形码 ' + qDigits + ' 查询</button>';
    hits.forEach(function (f) { h += foodRow(f); });
    if (gen.length) h += '<div class="mod-title r-sec">通用食物库 · USDA 平均值</div>' + gen.map(foodRow).join("");
    if (!hits.length && !gen.length) h += '<div class="r-none">食物库里没有「' + esc(searchQuery) + '」。</div>';
    h += '<button class="r-guess" data-act="open-guess">＋ 先记一条估计（' + esc(searchQuery) + '）</button></div>';
  } else {
    h += '<div class="chips">' + COMBOS.map(function (c) {
      return '<button class="chip combo" data-act="quick-combo" data-combo="' + c.id + '">☆ ' + esc(c.name) +
        ' <span class="kc">' + comboKcal(c) + '</span></button>';
    }).join("") + chipCandidates(8).map(function (f) {
      var dp = f.portions.find(function (p) { return p.label === f.default_portion; }) || f.portions[0];
      var main = '<button class="chip" data-act="quick-log" data-food="' + f.id + '">' +
        '<span class="t">' + esc(f.name) + '</span>' +
        '<span class="kc">' + kcalOf(f, dp.grams) + '</span></button>';
      /* 他用厨房秤：上次称的克数和常用份量差得明显时（≥ CHIP_LAST_MIN_KCAL），多给一个点法。
         差几克的不显示——蛋白粉预设 1 勺 30 g、他实际 48 g 这种才值得单独一个按钮 */
      var lg = lastGramsOf(f.id);
      if (lg == null || lg === dp.grams) return main;
      if (Math.abs(kcalOf(f, lg) - kcalOf(f, dp.grams)) < CHIP_LAST_MIN_KCAL) return main;
      return '<span class="chipwrap">' + main +
        '<button class="chip lastg" data-act="quick-log-last" data-food="' + f.id + '" data-g="' + lg + '">' +
        '上次 ' + lg + ' g <span class="kc">' + kcalOf(f, lg) + '</span></button></span>';
    }).join("") + '</div>' +
    '<div class="hint" style="padding-top:2px">按最近吃得多的排。点名字＝按常用份量（一勺／一个／一包）记一条；旁边出现「上次 N g」时点它＝按你上次称的克数记（只在两者差 25 kcal 以上时出现）。都能撤销、能改份量。☆ 是组合，一键记几样。搜索可挑份量或输克数。</div>';
  }
  el.innerHTML = h;
}
export function renderTodayBottom() {
  var el = document.getElementById("today-bottom");
  var t = viewDate;
  var dayW = viewingToday() ? "今日" : viewDate.slice(5).replace("-", "/") + " ";   /* 日期后面留个空格：「09/13 流水」 */
  var entries = entriesOfView();
  var tot = dayTotals(entries);
  var h = "";
  function macroRow(label, val, target, goodFill) {
    var over = val > target;
    var pct = Math.min(100, Math.round(val / target * 100));
    var left = Math.round((target - val) * 10) / 10;
    return '<div class="rowline" style="margin-top:7px"><span class="k">' + label + '</span>' +
      '<span class="v' + (over ? ' warn' : '') + '">' + val + ' / ' + target + ' g' +
      (over ? '（超 ' + Math.abs(left) + '）' : '（还可 ' + left + '）') + '</span></div>' +
      '<div class="bar"><i class="' + (over ? 'fill-over' : goodFill) + '" style="width:' + pct + '%"></i></div>';
  }
  h += '<div class="mod"><div class="mod-title">营养素</div>' +
    macroRow('蛋白质', tot.prot, BUILD.protein_target, 'fill-good') +
    macroRow('碳水', tot.carb, BUILD.carb_target, 'fill-brass') +
    macroRow('脂肪', tot.fat, BUILD.fat_target, 'fill-brass') +
    '<div class="hint" style="margin-top:6px">上限由每日 ' + BUILD.kcal_target + ' kcal 拆分：蛋白优先、脂肪约三成、其余碳水。' +
    (tot.hasGuess ? '「估」条目只计热量。' : '') + '</div></div>';

  var tr = trainingOfView();
  var sel = tr ? tr.types : [];
  var estK = 0, estM = 0;
  h += '<div class="mod"><div class="mod-title">' + dayW + '训练</div><div class="tchips">';
  TRAINING_PRESETS.forEach(function (p) {
    var on = sel.indexOf(p.type) >= 0;
    if (on) { estK += trainingKcal(tr, p.type); estM += trainingMin(tr, p.type); }
    h += '<button class="tchip" data-act="toggle-training" data-type="' + p.type + '" aria-pressed="' + on + '">' + p.label + '</button>';
  });
  h += '</div>';
  TRAINING_PRESETS.forEach(function (p) {
    if (sel.indexOf(p.type) < 0) return;
    var m = trainingMin(tr, p.type);
    h += '<div class="trow"><span class="tl">' + p.label + '</span>' +
      '<input type="range" min="10" max="180" step="5" value="' + m + '" data-tmin="' + p.type + '" aria-label="' + p.label + '时长">' +
      '<span class="tv" id="tv-' + p.type + '">' + m + '分·' + trainingKcal(tr, p.type) + '</span></div>';
  });
  if (estM > 0) {
    h += '<div class="rowline" style="margin-top:9px"><span class="k">估算消耗</span><span class="v" id="t-est">约 ' + estK + ' kcal · ' + estM + ' 分钟</span></div>';
  }
  h += '<div class="hint" style="margin-top:6px">拖动改时长；消耗按你手表实测均值折算，只作记录、不计入额度。</div></div>';

  h += '<div class="mod"><div class="mod-title">' + dayW + '流水</div>';
  if (!entries.length) {
    h += '<div class="empty">' + (viewingToday() ? "还没有记录。点上面的食物，一下就记完一条。" :
      "这天没有记录。照样可以点上面的食物补记，时间按现在的钟点算在这一天。") + '</div>';
  } else {
    h += '<div class="ledger">';
    MEAL_ORDER.forEach(function (meal) {
      var group = entries.filter(function (e) { return mealOf(e.ts) === meal; });
      if (!group.length) return;
      var sum = group.reduce(function (a, e) { return a + (e.kcal || 0); }, 0);
      h += '<div class="meal-h"><span class="m">' + meal + '</span><span class="s">' + sum + '</span></div>';
      group.forEach(function (e) {
        var dotCls = e.pending ? "guess" : (e.confidence === "high" ? "hi" : "lo");
        var nm = e.food_id ? e.name : (e.name_raw + "（估）");
        var q = e.pending
          ? "待入库" + (e.amount_note && e.amount_note !== "全部" ? " · " + esc(e.amount_note) : "")
          : esc(e.portion || (e.grams + " g"));
        h += '<button class="item' + (e.id === flashId ? " flash" : "") + '" data-act="edit-entry" data-id="' + e.id + '">' +
          '<span class="nm"><i class="dot ' + dotCls + '"></i><span class="t">' + esc(nm) + '</span>' +
          '<span class="q">' + q + '</span></span><span class="kc">' + (e.kcal || 0) + '</span></button>';
      });
    });
    h += '</div>';
  }
  h += '</div>';
  var comp = dayComplete(t);
  var compLabel = (viewingToday() ? "今天" : dayLabel(t)) + "记全了";
  h += '<div class="mod" id="complete-mod"><div class="switchrow"><div><div class="k">' + compLabel + '</div>' +
    '<div class="hint">只有打开此开关的天才进入消耗量的计算</div></div>' +
    '<button class="sw" role="switch" aria-checked="' + comp + '" data-act="toggle-complete" aria-label="' + compLabel + '"></button>' +
    '</div></div>';
  h += renderHistoryMod(todayStr());
  el.innerHTML = h;
}
/* 过去 7/14 天概览：摄入 vs 目标（细条）、晨重、碳蛋脂、训练、是否记全 */
export var histExpanded = false;
export function setHistExpanded(v) { histExpanded = v; }
export function renderHistoryMod(today) {
  var byDay = {};
  DB.log.forEach(function (e) {
    var d = (e.ts || "").slice(0, 10);
    if (!d || d === today) return;
    var r = byDay[d] || (byDay[d] = { kcal: 0, prot: 0, carb: 0, fat: 0 });
    r.kcal += e.kcal || 0; r.prot += e.protein || 0;
    r.carb += e.carb || 0; r.fat += e.fat || 0;
  });
  /* 按日历天列，没记录的那天也列出来——漏记一整天才更需要点进去补 */
  var first = null;
  DB.log.forEach(function (e) { var d = (e.ts || "").slice(0, 10); if (d && (!first || d < first)) first = d; });
  DB.training.forEach(function (r) { if (r.date && (!first || r.date < first)) first = r.date; });
  var n = histExpanded ? 14 : 7;
  var dates = [];
  for (var i = 1; i <= n; i++) {
    var d = dateShift(today, -i);
    if (first && d < first) break;
    dates.push(d);
  }
  var h = '<div class="mod"><div class="mod-title">过去 ' + n + ' 天</div>';
  if (!dates.length) {
    return h + '<div class="hint">记录攒起来后，这里按天显示摄入、体重和训练，点一行能翻回那天改。</div></div>';
  }
  var TN = { strength: "力", incline: "坡", stairs: "梯" };
  var mwByDate = {};
  DB.weight.forEach(function (w) { if (w.context === "morning") mwByDate[w.date] = w.kg; });
  dates.forEach(function (d) {
    var r = byDay[d] || { kcal: 0, prot: 0, carb: 0, fat: 0 };
    var empty = !byDay[d];
    var tr = trainingOn(d);
    var icons = (tr && tr.types ? tr.types.map(function (x) { return TN[x] || ""; }).join("") : "");
    var over = BUILD.kcal_target != null && r.kcal > BUILD.kcal_target;
    var pct = BUILD.kcal_target ? Math.min(100, Math.round(r.kcal / BUILD.kcal_target * 100)) : 0;
    h += '<button class="hrow' + (d === viewDate ? " sel" : "") + '" data-act="view-day" data-date="' + d + '">' +
      '<div class="hl"><span class="hd">' + d.slice(5) + ' ' + weekdayOf(d).slice(1) + '</span>' +
        '<span class="hk' + (over ? " over" : "") + '">' + Math.round(r.kcal) + '</span>' +
        '<span class="hw">' + (mwByDate[d] != null ? mwByDate[d].toFixed(1) + ' kg' : '') + '</span>' +
        '<span class="hi">' + (icons ? "练:" + icons : "") + (dayComplete(d) ? " ✓" : "") + '</span>' +
        '<span class="hgo">›</span></div>' +
      '<div class="bar thin"><i class="' + (over ? "fill-over" : "fill-brass") + '" style="width:' + pct + '%"></i></div>' +
      '<div class="hm">' + (empty ? '这天没有记录' :
        '蛋 ' + Math.round(r.prot) + ' · 碳 ' + Math.round(r.carb) + ' · 脂 ' + Math.round(r.fat)) + '</div></button>';
  });
  h += '<div class="hint" style="padding-top:8px">点一行翻回那天：可以补记、改记录、补打「记全了」。</div>';
  if (!first || dateShift(today, -8) >= first) {
    h += '<button class="r-guess" data-act="hist-toggle">' + (histExpanded ? "只看 7 天" : "显示 14 天") + '</button>';
  }
  return h + '</div>';
}
export function renderToday() {
  renderBanner();
  renderTodayTop();
  renderQuickBody();
  renderAiMod();
  renderTodayBottom();
  syncTopbar();
  setFlash(null);
}
/* 搜索：输入框常驻不重建，避免打断 iOS 中文输入法的组字过程 */
export var composing = false;
elSearch.addEventListener("compositionstart", function () { composing = true; });
elSearch.addEventListener("compositionend", function () {
  composing = false;
  searchQuery = elSearch.value;
  elClear.style.display = searchQuery ? "" : "none";
  renderQuickBody();
});
elSearch.addEventListener("input", function () {
  if (composing) return;
  searchQuery = elSearch.value;
  elClear.style.display = searchQuery ? "" : "none";
  renderQuickBody();
});
elClear.addEventListener("click", function () { clearSearch(); renderQuickBody(); });

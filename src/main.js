import { MEAL_DRAFT, aiBusy, aiEstimateMealText, aiNeedKey, aiPhotoStart, aiReady, mealItemKcal, mealRecalc, openMealSheet, saveAiKey, setMealDraft, textFoodFor } from "./ai.js";
import { MAX_G, newId, todayStr } from "./lib/util.js";
import { lookupBarcode, scanClose, scanLiveStart, scanManualGo, scanPhotoStart, scanSave, scanTorch, scanUseFood, scanWarnRefresh, setScanDraft } from "./scan.js";
import { addEntry, aiEntryPer100, buildEntry, closeSheet, confirmGuess, deleteEntry, elSheet, guessAmount, logCombo, openAiEntrySheet, openGuessSheet, openOrphanSheet, openPortionSheet, setGuessAmount, showUndoToast, showUndoToastMulti } from "./sheets.js";
import { REVERT_MIN, entryTs, setFlash, setViewDate, setViewDateRaw, syncTopbar, viewDate, viewingToday } from "./state.js";
import { DB, K, UF_KEY, USER_FOODS, dayComplete, foodById, persist, reloadDB, setDayComplete, setUserFoods, storeBroken } from "./store.js";
import { presetOf, setTrainingMin, toggleTraining, trainingKcal, trainingMin, trainingOfView } from "./training.js";
import { doExport, importInput, renderExport } from "./views/export.js";
import { renderLibrary } from "./views/library.js";
import { dismissBanner, histExpanded, renderBanner, renderToday, renderTodayBottom, searchQuery, setHistExpanded } from "./views/today.js";
import { renderWeight, saveWeight, setWeightCtx, stepKg } from "./views/weight.js";
import { setTrendRange } from "./views/weightChart.js";

/* ── 入口 ──────────────────────────────────────────────────
   模块地图（v2.0 从单文件 index.html 按原有分节拆出，行为不变）：
     build.js            发布常数（周报校准后改这里）
     data/foods.js       内置食物库、个人食物覆盖层（UF_SAME_AS / UF_FIX）、常吃组合
     data/logfix.js      流水逐条更正
     lib/*               纯计算：交叉校验、AI/条形码数据解析、排序、日期、备份合并（tests/unit 覆盖）
     store.js            localStorage 读写、食物查找
     state.js            正在看哪一天、刚记的那条（闪一下）
     sheets.js           底部弹出面板、撤销条、记录增删改
     ai.js / scan.js     AI 识别、条形码
     training.js         今日训练
     views/*.js          四个页面
   本文件：Tab 切换、全局点击分发、启动与跨午夜刷新。 */

/* ── Tab 切换与全局事件 ─────────────────────────────────── */
export var VIEWS = { today: renderToday, weight: renderWeight, library: renderLibrary, export: renderExport };
export var TITLES = { today: "今日", weight: "体重", library: "食物库", export: "导出" };
export function activeTab() {
  var b = document.querySelector('.tabs button[aria-pressed="true"]');
  return b ? b.getAttribute("data-tab") : "today";
}
export function switchTab(tab) {
  ["today", "weight", "library", "export"].forEach(function (k) {
    document.getElementById("view-" + k).style.display = (k === tab) ? "flex" : "none";
  });
  document.querySelectorAll(".tabs button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.getAttribute("data-tab") === tab));
  });
  document.getElementById("tb-title").textContent = TITLES[tab];
  VIEWS[tab]();
  syncTopbar();
}
document.querySelector(".tabs").addEventListener("click", function (ev) {
  var b = ev.target.closest("button[data-tab]");
  if (b) switchTab(b.getAttribute("data-tab"));
});

/* 快速连点保护：这些动作依赖面板还开着 */
export var NEED_SHEET = { "pick-portion": 1, "pick-grams": 1, "confirm-grams": 1, "confirm-guess": 1, "delete-entry": 1, "pick-amount": 1, "meal-del": 1, "meal-confirm": 1, "ai-entry-save": 1,
                   "scan-save": 1, "scan-use-food": 1, "scan-ai-label": 1, "scan-manual-go": 1, "scan-retry": 1, "scan-guess": 1 };
document.addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-act]");
  if (!b) return;
  var act = b.getAttribute("data-act");
  var sheetB = elSheet.querySelector(".sheet-b");
  if (NEED_SHEET[act] && !sheetB) return;
  var foodId = sheetB ? sheetB.getAttribute("data-food") : null;
  var replaceId = sheetB ? (sheetB.getAttribute("data-replace") || null) : null;

  if (act === "quick-log") {
    var qf = foodById(b.getAttribute("data-food"));
    if (!qf) return;
    var dp = qf.portions.find(function (p) { return p.label === qf.default_portion; }) || qf.portions[0];
    if (!dp) return;
    var entry = addEntry(qf.id, dp.label, dp.grams, null);
    if (entry) showUndoToast(entry);
  }
  else if (act === "quick-log-last") {
    var lf = foodById(b.getAttribute("data-food")), lgv = parseFloat(b.getAttribute("data-g"));
    if (!lf || !(lgv > 0)) return;
    var le = addEntry(lf.id, Math.round(lgv) + " g", lgv, null);
    if (le) showUndoToast(le);
  }
  else if (act === "open-food") openPortionSheet(b.getAttribute("data-food"), null);
  else if (act === "pick-portion") {
    var f = foodById(foodId);
    if (!f) return;
    var p = f.portions[parseInt(b.getAttribute("data-i"), 10)];
    if (!p) return;
    addEntry(foodId, p.label, p.grams, replaceId);
  }
  else if (act === "pick-grams") {
    var g0 = parseFloat(b.getAttribute("data-g"));
    if (g0 > 0) addEntry(foodId, Math.round(g0) + " g", g0, replaceId);
  }
  else if (act === "confirm-grams") {
    var gEl = document.getElementById("in-grams");
    if (!gEl) return;
    var g = parseFloat(gEl.value);
    if (g > 0 && g <= MAX_G) addEntry(foodId, Math.round(g) + " g", g, replaceId);
    else gEl.classList.add("bad");
  }
  else if (act === "open-guess") openGuessSheet(searchQuery, null);
  else if (act === "pick-amount") {
    setGuessAmount(b.getAttribute("data-a"));
    document.querySelectorAll('#amount-seg button').forEach(function (x) {
      x.setAttribute("aria-pressed", String(x.getAttribute("data-a") === guessAmount));
    });
  }
  else if (act === "confirm-guess") confirmGuess(replaceId);
  else if (act === "edit-entry") {
    var id = b.getAttribute("data-id");
    var e = DB.log.find(function (x) { return x.id === id; });
    if (!e) return;
    if (e.food_id) {
      if (foodById(e.food_id)) openPortionSheet(e.food_id, id);
      else openOrphanSheet(e, id);
    } else if (e.pending || !e.ai) {
      openGuessSheet("", id);
    } else {
      openAiEntrySheet(e, id);
    }
  }
  else if (act === "delete-entry") {
    if (b.getAttribute("data-armed")) { deleteEntry(replaceId); }
    else { b.setAttribute("data-armed", "1"); b.textContent = "确认删除？"; }
  }
  else if (act === "view-day") { setViewDate(b.getAttribute("data-date")); }
  else if (act === "back-today") { setViewDate(todayStr()); }
  else if (act === "toggle-complete") {
    var t = viewDate;
    setDayComplete(t, !dayComplete(t));
    renderBanner();
    renderTodayBottom();
  }
  else if (act === "toggle-training") {
    toggleTraining(b.getAttribute("data-type"));
    renderTodayBottom();
  }
  else if (act === "hist-toggle") { setHistExpanded(!histExpanded); renderTodayBottom(); }
  else if (act === "quick-combo") logCombo(b.getAttribute("data-combo"));
  else if (act === "del-userfood") {
    if (b.getAttribute("data-armed")) {
      var ufid = b.getAttribute("data-food");
      setUserFoods(USER_FOODS.filter(function (f) { return f.id !== ufid; }));
      persist(UF_KEY, USER_FOODS);
      renderLibrary();
    } else { b.setAttribute("data-armed", "1"); b.textContent = "确认删除？"; }
  }
  else if (act === "ai-entry-save") {
    var ae = DB.log.find(function (x) { return x.id === replaceId; });
    var gEl2 = document.getElementById("in-ai-g"), nEl2 = document.getElementById("in-ai-name");
    if (!ae || !gEl2) return;
    var g2 = parseFloat(gEl2.value);
    if (!(g2 > 0 && g2 <= MAX_G)) { gEl2.classList.add("bad"); return; }
    var per2 = aiEntryPer100(ae);
    ae.per_100g = { kcal: Math.round(per2.kcal * 10) / 10, protein: Math.round(per2.protein * 10) / 10,
                    fat: Math.round(per2.fat * 10) / 10, carb: Math.round(per2.carb * 10) / 10 };
    ae.grams = Math.round(g2); ae.portion = ae.grams + " g";
    ae.kcal = Math.round(per2.kcal * g2 / 100);
    ae.protein = Math.round(per2.protein * g2 / 100 * 10) / 10;
    ae.fat = Math.round(per2.fat * g2 / 100 * 10) / 10;
    ae.carb = Math.round(per2.carb * g2 / 100 * 10) / 10;
    if (nEl2 && nEl2.value.trim()) ae.name_raw = nEl2.value.trim().slice(0, 30);
    setFlash(ae.id);
    persist(K.log, DB.log);
    closeSheet();
    renderToday();
  }
  else if (act === "scan-live") { closeSheet(); scanLiveStart(); }
  else if (act === "scan-photo") { closeSheet(); scanPhotoStart(); }
  else if (act === "scan-to-photo") { scanClose(); scanPhotoStart(); }
  else if (act === "scan-cancel") scanClose();
  else if (act === "scan-torch") scanTorch(b);
  else if (act === "scan-code") scanManualGo(b.getAttribute("data-code"));
  else if (act === "scan-manual-go") { var bcEl = document.getElementById("in-bc"); scanManualGo(bcEl ? bcEl.value : ""); }
  else if (act === "scan-retry") lookupBarcode(sheetB.getAttribute("data-bc"));
  else if (act === "scan-save") scanSave();
  else if (act === "scan-use-food") scanUseFood(sheetB.getAttribute("data-bc"), b.getAttribute("data-food"));
  else if (act === "scan-ai-label") {
    var bcA = sheetB.getAttribute("data-bc");
    setScanDraft(null);
    closeSheet();
    if (!aiBusy) aiPhotoStart("label", bcA);
  }
  else if (act === "scan-guess") openGuessSheet("", null);
  else if (act === "save-ai-key") saveAiKey();
  else if (act === "ai-label-photo") { if (!aiReady()) aiNeedKey(); else if (!aiBusy) aiPhotoStart("label"); }
  else if (act === "ai-meal-photo") { if (!aiReady()) aiNeedKey(); else if (!aiBusy) aiPhotoStart("meal"); }
  else if (act === "ai-meal-text") {
    var mtEl = document.getElementById("ai-meal-text");
    if (!aiReady()) aiNeedKey();
    else if (!aiBusy) aiEstimateMealText(mtEl ? mtEl.value.trim() : "");
  }
  else if (act === "meal-del") {
    var mi = parseInt(b.getAttribute("data-i"), 10);
    if (MEAL_DRAFT && MEAL_DRAFT.items[mi] != null) {
      MEAL_DRAFT.items.splice(mi, 1);
      if (MEAL_DRAFT.items.length) openMealSheet(MEAL_DRAFT);
      else { setMealDraft(null); closeSheet(); }
    }
  }
  else if (act === "meal-confirm") {
    if (!MEAL_DRAFT) return;
    var mItems = MEAL_DRAFT.items.filter(function (it) { return it.grams > 0 && it.name; });
    if (!mItems.length) { setMealDraft(null); closeSheet(); return; }
    var madeM = [], fromText = MEAL_DRAFT.src === "text", ufAdded = 0;
    mItems.forEach(function (it) {
      if (fromText) {
        /* 文字估算：同名的食物库条目直接用它；没有就新建一条个人食物，以后可以直接点 */
        var tf = textFoodFor(it, MEAL_DRAFT.note);
        if (tf.created) ufAdded++;
        var te = buildEntry(tf.food, Math.round(it.grams) + " g", Math.round(it.grams));
        te.ai = true;
        DB.log.push(te); madeM.push(te);
        return;
      }
      var en = {
        id: newId(), ts: entryTs(), food_id: null, name_raw: it.name,
        portion: Math.round(it.grams) + " g", grams: Math.round(it.grams),
        kcal: mealItemKcal(it),
        protein: Math.round(it.per_100g.protein * it.grams / 100 * 10) / 10,
        fat: Math.round(it.per_100g.fat * it.grams / 100 * 10) / 10,
        carb: Math.round(it.per_100g.carb * it.grams / 100 * 10) / 10,
        per_100g: it.per_100g,
        confidence: "low", pending: false, ai: true
      };
      DB.log.push(en); madeM.push(en);
    });
    setFlash(madeM[madeM.length - 1].id);
    persist(K.log, DB.log);
    if (ufAdded) persist(UF_KEY, USER_FOODS);
    setMealDraft(null);
    closeSheet();
    renderToday();
    showUndoToastMulti(madeM, "AI 估算");
  }
  else if (act === "dismiss-banner") {
    ev.stopPropagation();
    dismissBanner(b.getAttribute("data-kind"));
  }
  else if (act === "go-weight") switchTab("weight");
  else if (act === "go-export") switchTab("export");
  else if (act === "go-complete") {
    var cm = document.getElementById("complete-mod");
    if (cm) cm.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  else if (act === "ctx-morning") { setWeightCtx("morning"); renderWeight(); }
  else if (act === "ctx-gym") { setWeightCtx("gym_pre"); renderWeight(); }
  else if (act === "ctx-other") { setWeightCtx("other"); renderWeight(); }
  else if (act === "trend-range") { setTrendRange(b.getAttribute("data-r")); renderWeight(); }
  else if (act === "kg-minus") stepKg(-0.1);
  else if (act === "kg-plus") stepKg(0.1);
  else if (act === "save-weight") saveWeight();
  else if (act === "do-export") doExport();
  else if (act === "do-import") { importInput.value = ""; importInput.click(); }
}, true);

/* 估餐确认面板：名字/克数即时生效，热量跟着变 */
document.addEventListener("input", function (ev) {
  var t = ev.target;
  if (!t.hasAttribute) return;
  if (t.hasAttribute("data-mg")) {
    var i = parseInt(t.getAttribute("data-mg"), 10);
    if (MEAL_DRAFT && MEAL_DRAFT.items[i]) {
      var g = parseFloat(t.value);
      MEAL_DRAFT.items[i].grams = (g > 0 && g <= MAX_G) ? g : 0;
      t.classList.toggle("bad", !!t.value && !(g > 0 && g <= MAX_G));
      mealRecalc();
    }
  } else if (t.hasAttribute("data-sper")) {
    scanWarnRefresh();
  } else if (t.hasAttribute("data-mname")) {
    var j = parseInt(t.getAttribute("data-mname"), 10);
    if (MEAL_DRAFT && MEAL_DRAFT.items[j]) MEAL_DRAFT.items[j].name = t.value.slice(0, 30);
  }
}, true);
/* 训练时长滑杆：拖动中只更新文字（避免重建打断手势），松手才落盘重绘 */
document.addEventListener("input", function (ev) {
  var s = ev.target;
  if (!s.hasAttribute || !s.hasAttribute("data-tmin")) return;
  var type = s.getAttribute("data-tmin");
  var m = parseInt(s.value, 10);
  setTrainingMin(type, m);
  var p = presetOf(type);
  var tv = document.getElementById("tv-" + type);
  if (tv && p) tv.textContent = m + "分·" + Math.round(m * p.rate);
  var rec = trainingOfView();
  var estK = 0, estM = 0;
  if (rec) rec.types.forEach(function (t) { estK += trainingKcal(rec, t); estM += trainingMin(rec, t); });
  var te = document.getElementById("t-est");
  if (te) te.textContent = "约 " + estK + " kcal · " + estM + " 分钟";
}, true);
document.addEventListener("change", function (ev) {
  if (ev.target.hasAttribute && ev.target.hasAttribute("data-tmin")) renderTodayBottom();
  /* 模型下拉选「自定义…」时显示手输框 */
  if (ev.target.hasAttribute && ev.target.hasAttribute("data-modelsel")) {
    var ci = document.getElementById(ev.target.getAttribute("data-modelsel"));
    if (ci) ci.style.display = ev.target.value === "__custom" ? "" : "none";
  }
}, true);

/* ── 启动与刷新 ─────────────────────────────────────────── */
export var shownDate = todayStr();
setViewDateRaw(shownDate);           /* 每次打开都从今天开始看 */
document.getElementById("tb-date").textContent = shownDate;
switchTab("today");

export function refreshIfNeeded(force) {
  var t = todayStr();
  var dateChanged = t !== shownDate;
  if (dateChanged) {
    shownDate = t;
    setViewDateRaw(t);             /* 跨午夜：回到新的今天，别把今天的饭记进昨天 */
    document.getElementById("tb-date").textContent = t;
  }
  if (dateChanged || force) {
    /* 正在输入时不强刷，避免清掉输入了一半的内容 */
    var ae = document.activeElement;
    if (!ae || (ae.tagName !== "INPUT" && ae.tagName !== "TEXTAREA")) VIEWS[activeTab()]();
    else if (dateChanged) VIEWS[activeTab()]();
  }
}
/* 切回前台：先从存储重读（防旧标签页用过期内存覆盖新记录），再判断要不要重绘 */
export var hiddenAt = 0;
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { hiddenAt = Date.now(); scanClose(); }   /* 切走就关摄像头 */
});
export function onVisible() {
  if (document.hidden) return;
  /* 翻回过去某天改完就切走了，隔了 REVERT_MIN 分钟再回来当作新的一次使用：跳回今天 */
  var reverted = false;
  if (!viewingToday() && hiddenAt && Date.now() - hiddenAt > REVERT_MIN * 60000) { setViewDateRaw(todayStr()); reverted = true; }
  var before = JSON.stringify([DB.log.length, DB.weight.length, DB.days.length]);
  if (!storeBroken) reloadDB();
  var after = JSON.stringify([DB.log.length, DB.weight.length, DB.days.length]);
  refreshIfNeeded(before !== after || reverted);
}
document.addEventListener("visibilitychange", onVisible);
window.addEventListener("pageshow", onVisible);
/* 前台跨午夜：30 秒哨兵，翻日自动切到新一天，防止「记全了」打到错误日期 */
setInterval(function () { refreshIfNeeded(false); }, 30000);

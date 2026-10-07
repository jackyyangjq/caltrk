import { COMBOS } from "./data/foods.js";
import { MAX_G, MAX_KCAL, esc, kcalOf, newId, protOf } from "./lib/util.js";
import { entryTs, setFlash } from "./state.js";
import { DB, K, foodById, lastGramsOf, persist } from "./store.js";
import { clearSearch, renderToday } from "./views/today.js";


/* ── 弹出面板 ───────────────────────────────────────────── */
export var elBackdrop = document.getElementById("backdrop");
export var elSheet = document.getElementById("sheet");
export var sheetClearTimer = null;
export function vvFit() {
  if (!window.visualViewport) return;
  var lift = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
  elSheet.style.marginBottom = lift ? lift + "px" : "";
}
export function openSheet(html) {
  if (sheetClearTimer) { clearTimeout(sheetClearTimer); sheetClearTimer = null; }
  elSheet.innerHTML = html;
  elBackdrop.classList.add("on");
  if (window.visualViewport) window.visualViewport.addEventListener("resize", vvFit);
}
export function closeSheet() {
  elBackdrop.classList.remove("on");
  if (window.visualViewport) window.visualViewport.removeEventListener("resize", vvFit);
  elSheet.style.marginBottom = "";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  sheetClearTimer = setTimeout(function () {
    if (!elBackdrop.classList.contains("on")) elSheet.innerHTML = "";
    sheetClearTimer = null;
  }, reduce ? 0 : 300);
}
elBackdrop.addEventListener("click", function (ev) { if (ev.target === elBackdrop) closeSheet(); });

/* 份量面板：预设份量 + 「上次克数」+ 内联克数输入（厨房秤主路径），单层无跳转 */
export function openPortionSheet(foodId, replaceId) {
  var f = foodById(foodId);
  if (!f) return;
  var meta = "每 100 g · " + f.per_100g.kcal + " kcal · 蛋白 " + f.per_100g.protein +
             " g · 脂肪 " + f.per_100g.fat + " g · 碳水 " + f.per_100g.carb + " g";
  var rows = f.portions.map(function (p, i) {
    var hi = (p.label === f.default_portion) ? " hi" : "";
    return '<button class="p' + hi + '" data-act="pick-portion" data-i="' + i + '">' +
      '<span class="l">' + esc(p.label) + '</span>' +
      '<span class="g">' + p.grams + ' g · ' + kcalOf(f, p.grams) + ' kcal</span></button>';
  });
  var lastG = lastGramsOf(f.id);
  var isPreset = lastG != null && f.portions.some(function (p) { return p.grams === lastG; });
  if (lastG != null && !isPreset) {
    rows.push('<button class="p" data-act="pick-grams" data-g="' + lastG + '">' +
      '<span class="l">上次 · ' + lastG + ' g</span>' +
      '<span class="g">' + kcalOf(f, lastG) + ' kcal</span></button>');
  }
  openSheet(
    '<div class="sheet-h"><div class="nm">' + esc(f.name) + '</div><div class="meta">' + meta + '</div></div>' +
    '<div class="sheet-b" data-food="' + f.id + '" data-replace="' + (replaceId || "") + '">' +
      '<div class="mod-title">选份量</div>' +
      '<div class="portions">' + rows.join("") + '</div>' +
      '<div class="field"><label>或输克数（厨房秤读数）</label>' +
      '<input id="in-grams" type="number" inputmode="decimal" min="1" max="' + MAX_G + '" placeholder="g"></div>' +
      '<div class="note" id="grams-preview" style="display:none"></div>' +
      '<button class="btn solid" id="btn-grams" data-act="confirm-grams" style="display:none">按克数记录</button>' +
      (f.fix_why ? '<div class="note">✎ 已修正：' + esc(f.fix_why) + '</div>' : '') +
      (entryFixNote(replaceId)) +
      (f.note ? '<div class="note">' + esc(f.note) + '</div>' : '') +
      (replaceId ? '<button class="btn danger" data-act="delete-entry">删除这条记录</button>' : '') +
    '</div>');
  var gi = document.getElementById("in-grams");
  gi.addEventListener("input", function () {
    var g = parseFloat(gi.value);
    var ok = g > 0 && g <= MAX_G;
    gi.classList.toggle("bad", !!gi.value && !ok);
    document.getElementById("grams-preview").style.display = ok ? "" : "none";
    document.getElementById("btn-grams").style.display = ok ? "" : "none";
    if (ok) document.getElementById("grams-preview").textContent =
      "= " + kcalOf(f, g) + " kcal · 蛋白 " + protOf(f, g) + " g";
  });
}
export function entryFixNote(id) {
  var e = id ? DB.log.find(function (x) { return x.id === id; }) : null;
  return (e && e.fix_why) ? '<div class="note">✎ 这条记录已更正：' + esc(e.fix_why) + '</div>' : '';
}
/* 库里已下架/改名的历史条目：只允许删除，不能编辑 */
export function openOrphanSheet(entry, id) {
  openSheet(
    '<div class="sheet-h"><div class="nm">' + esc(entry.name || entry.name_raw || "旧记录") + '</div>' +
    '<div class="meta">' + (entry.kcal || 0) + ' kcal · ' +
    (entry.ai ? 'AI 估算条目：要改数值请删除后重新估算' : '该食物已不在当前食物库中，只能删除') + '</div></div>' +
    '<div class="sheet-b" data-replace="' + id + '">' +
      '<button class="btn danger" data-act="delete-entry">删除这条记录</button>' +
    '</div>');
}

export function buildEntry(f, portionLabel, grams) {
  return {
    id: newId(),
    ts: entryTs(), food_id: f.id, name: f.name, portion: portionLabel,
    grams: grams, kcal: kcalOf(f, grams), protein: protOf(f, grams),
    fat: Math.round(f.per_100g.fat * grams / 100 * 10) / 10,
    carb: Math.round(f.per_100g.carb * grams / 100 * 10) / 10,
    confidence: f.confidence, pending: false
  };
}

export function comboKcal(c) {
  return c.items.reduce(function (a, it) { var f = foodById(it[0]); return a + (f ? kcalOf(f, it[1]) : 0); }, 0);
}
export function logCombo(id) {
  var c = COMBOS.filter(function (x) { return x.id === id; })[0];
  if (!c) return;
  var made = [];
  c.items.forEach(function (it) {
    var f = foodById(it[0]);
    if (f) made.push(buildEntry(f, it[1] + " g", it[1]));
  });
  if (!made.length) return;
  made.forEach(function (e) { DB.log.push(e); });
  setFlash(made[made.length - 1].id);
  persist(K.log, DB.log);
  renderToday();
  showUndoToastMulti(made, c.name);
}
export function addEntry(foodId, portionLabel, grams, replaceId) {
  var f = foodById(foodId);
  if (!f || !(grams > 0) || grams > MAX_G) return null;
  var entry = buildEntry(f, portionLabel, grams);
  if (replaceId) {
    var idx = DB.log.findIndex(function (e) { return e.id === replaceId; });
    if (idx >= 0) { entry.ts = DB.log[idx].ts; DB.log[idx] = entry; }
    else DB.log.push(entry);
  } else {
    DB.log.push(entry);
  }
  setFlash(entry.id);
  persist(K.log, DB.log);
  clearSearch();
  closeSheet();
  renderToday();
  return entry;
}
/* 占位条目：新食物当场估计（设计 §4.3/§5.3），amount_note 记吃了多少，供照片精确回算 */
export var AMOUNTS = ["全部", "一半", "三分之一", "三分之二"];
export var guessAmount = "全部";
export function setGuessAmount(v) { guessAmount = v; }
export function openGuessSheet(prefill, editId) {
  var old = editId ? DB.log.find(function (e) { return e.id === editId; }) : null;
  guessAmount = (old && old.amount_note) ? old.amount_note : "全部";
  var amountBtns = AMOUNTS.map(function (a) {
    return '<button data-act="pick-amount" data-a="' + a + '" aria-pressed="' + (a === guessAmount) + '">' + a + '</button>';
  }).join("");
  openSheet(
    '<div class="sheet-h"><div class="nm">' + (editId ? "修改估计条目" : "先记一条估计") + '</div>' +
    '<div class="meta">拍下外包装＋营养成分表存进「待入库」，之后按照片精确回算</div></div>' +
    '<div class="sheet-b" data-replace="' + (editId || "") + '">' +
      '<div class="field"><label>名称</label>' +
      '<input id="in-gname" type="text" placeholder="例：Tesco 意面沙拉" value="' + esc(old ? old.name_raw : prefill) + '"></div>' +
      '<div class="field"><label>吃了多少</label>' +
      '<div class="seg c4" id="amount-seg">' + amountBtns + '</div></div>' +
      '<div class="field"><label>估计热量（你吃掉的部分，kcal）</label>' +
      '<input id="in-gkcal" type="number" inputmode="numeric" min="1" max="' + MAX_KCAL + '" value="' + (old && old.kcal ? old.kcal : "") + '"></div>' +
      '<button class="btn solid" data-act="confirm-guess">' + (editId ? "保存修改" : "记录") + '</button>' +
      (editId ? '<button class="btn danger" data-act="delete-entry">删除这条记录</button>' : '') +
    '</div>');
  document.getElementById(editId ? "in-gkcal" : "in-gname").focus();
}
export function confirmGuess(editId) {
  var nameEl = document.getElementById("in-gname");
  var kcalEl = document.getElementById("in-gkcal");
  if (!nameEl || !kcalEl) return;
  var name = nameEl.value.trim();
  var kcal = parseInt(kcalEl.value, 10);
  if (!name || !(kcal > 0) || kcal > MAX_KCAL) {
    if (kcal > MAX_KCAL) kcalEl.classList.add("bad");
    return;
  }
  if (editId) {
    var idx = DB.log.findIndex(function (e) { return e.id === editId; });
    if (idx >= 0) {
      DB.log[idx].name_raw = name; DB.log[idx].kcal = kcal; DB.log[idx].amount_note = guessAmount;
      setFlash(editId);
    }
  } else {
    var entry = {
      id: newId(),
      ts: entryTs(), food_id: null, name_raw: name, grams: null,
      kcal: kcal, protein: null, confidence: "guess", pending: true,
      amount_note: guessAmount
    };
    DB.log.push(entry);
    setFlash(entry.id);
  }
  persist(K.log, DB.log);
  clearSearch();
  closeSheet();
  renderToday();
}
export function deleteEntry(id) {
  DB.log = DB.log.filter(function (e) { return e.id !== id; });
  persist(K.log, DB.log);
  closeSheet();
  renderToday();
}

/* ── 一键记录的撤销条 ───────────────────────────────────── */
export var toastEl = null, toastTimer = null;
export function dismissToast() {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
  toastEl = null;
}
export function showUndoToast(entry) {
  dismissToast();
  toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.innerHTML =
    '<span class="msg">已记：' + esc(entry.name) + ' <b>' + entry.kcal + '</b> kcal</span>' +
    '<button data-toast="undo">撤销</button>' +
    '<button data-toast="edit">改份量</button>';
  toastEl.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-toast]");
    if (!b) return;
    var kind = b.getAttribute("data-toast");
    if (kind === "undo") { deleteEntry(entry.id); }
    else if (kind === "edit") { openPortionSheet(entry.food_id, entry.id); }
    dismissToast();
  });
  document.body.appendChild(toastEl);
  toastTimer = setTimeout(dismissToast, 6000);
}
/* 多条一起记（组合、AI 估餐）的撤销条：一键全撤 */
export function showUndoToastMulti(entries, label) {
  dismissToast();
  var sum = entries.reduce(function (a, e) { return a + (e.kcal || 0); }, 0);
  toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.innerHTML = '<span class="msg">已记 ' + esc(label) + '（' + entries.length + ' 项）<b>' + sum + '</b> kcal</span>' +
    '<button data-toast="undo">撤销</button>';
  toastEl.addEventListener("click", function (ev) {
    if (!ev.target.closest("[data-toast]")) return;
    var ids = entries.map(function (e) { return e.id; });
    DB.log = DB.log.filter(function (e) { return ids.indexOf(e.id) < 0; });
    persist(K.log, DB.log);
    renderToday();
    dismissToast();
  });
  document.body.appendChild(toastEl);
  toastTimer = setTimeout(dismissToast, 6000);
}
/* AI 估算条目：改克数按每 100 g 密度重算（老条目没存密度就从总量反推） */
export function aiEntryPer100(e) {
  if (e.per_100g) return e.per_100g;
  var f = e.grams > 0 ? 100 / e.grams : 1;
  return { kcal: (e.kcal || 0) * f, protein: (e.protein || 0) * f, fat: (e.fat || 0) * f, carb: (e.carb || 0) * f };
}
export function openAiEntrySheet(e, id) {
  var per = aiEntryPer100(e);
  openSheet(
    '<div class="sheet-h"><div class="nm">' + esc(e.name_raw || "AI 估算") + '</div>' +
    '<div class="meta">AI 估算条目 · 每 100 g 约 ' + Math.round(per.kcal) + ' kcal</div></div>' +
    '<div class="sheet-b" data-replace="' + id + '">' +
      '<div class="field"><label>名称</label><input id="in-ai-name" type="text" value="' + esc(e.name_raw || "") + '"></div>' +
      '<div class="field"><label>克数</label><input id="in-ai-g" type="number" inputmode="decimal" min="1" max="' + MAX_G + '" value="' + (e.grams || "") + '"></div>' +
      '<div class="note" id="ai-g-preview">= ' + (e.kcal || 0) + ' kcal</div>' +
      '<button class="btn solid" data-act="ai-entry-save">更新</button>' +
      entryFixNote(id) +
      '<button class="btn danger" data-act="delete-entry">删除这条记录</button>' +
    '</div>');
  var gi = document.getElementById("in-ai-g");
  gi.addEventListener("input", function () {
    var g = parseFloat(gi.value);
    var ok = g > 0 && g <= MAX_G;
    gi.classList.toggle("bad", !!gi.value && !ok);
    document.getElementById("ai-g-preview").textContent = ok ? "= " + Math.round(per.kcal * g / 100) + " kcal" : "";
  });
}

import { compareSpecs, validateFoodSpec, webCheck } from "./lib/checks.js";
import { OFF_FIELDS, aiParseFood, aiParseMeal, offToSpec, webParse } from "./lib/parse.js";
import { MAX_G, esc, normName, todayStr } from "./lib/util.js";
import { switchTab } from "./main.js";
import { openPortionSheet, openSheet } from "./sheets.js";
import { UF_KEY, USER_FOODS, allFoods, loadObj, persist, ufView } from "./store.js";
import { renderExport } from "./views/export.js";
import { renderAiMod } from "./views/today.js";

/* ── AI 识别（可选功能，BYOK：用户在本页设置里粘贴自己的 ChatAnywhere
   密钥，仅保存在用户自己设备的浏览器存储中；页面从浏览器直连该服务，
   密钥不写入代码仓库、不包含在导出文件里，也不经过任何中间人）────── */
export var AI_CFG_STORE = "caltrk7f3a.ai.v1";

export var AI = loadObj(AI_CFG_STORE);
if (!AI.base) AI.base = "https://api.chatanywhere.org";
export var AI_DEFAULT_MODEL = "gemini-3.8-flash";
export var AI_FALLBACK_MODEL = "gpt-4.1-mini";   /* 新模型调不通时自动退回的老默认，2026-09 前一直在用、确认能读图 */
if (!AI.model) AI.model = AI_DEFAULT_MODEL;
/* 2026-09-01 一次性迁移：旧默认 gpt-4o-mini 是页面自动填的（用户没主动选过），升到 4.1-mini */
if (AI.key && AI.model === "gpt-4o-mini" && !AI.m41) { AI.model = "gpt-4.1-mini"; AI.m41 = 1; persist(AI_CFG_STORE, AI); }
/* 2026-10-06 一次性迁移（用户要求）：旧型号换成同价位的新一代；用户之后再改回去不会被覆盖 */
if (!AI.m26) {
  var M26 = { "gpt-4.1-mini": "gemini-3.8-flash", "gemini-2.5-flash": "gemini-3.8-flash", "gpt-4o-mini": "gpt-6-luna",
    "gpt-5-mini": "gpt-6-luna", "gpt-4.1": "gpt-6.1-sol", "claude-sonnet-5": "claude-sonnet-5-5" };
  if (M26[AI.model]) AI.model = M26[AI.model];
  /* 复核模型要和识别模型不同厂商，才有互查的意义 */
  if (AI.model2 && M26[AI.model2]) AI.model2 = /^gemini/.test(AI.model) ? "gpt-6-luna" : "gemini-3.8-flash";
  AI.m26 = 1;
  persist(AI_CFG_STORE, AI);
}
/* 下拉候选：ChatAnywhere 在售模型（2026-10-06 查其价目页，9/30 版），按每次识别的大致花费从低到高。
   价格（CA币/千 token，输入/输出）：gpt-6-luna 0.0007/0.0035；gemini-3.8-flash 0.003/0.015；
   gpt-4.1-mini 0.0028/0.0112；gpt-5.4-mini 0.00525/0.0315；gpt-6.1-sol 0.014/0.07；claude-sonnet-5-5 0.01/0.05 */
export var MODEL_OPTS = [
  ["gemini-3.8-flash", "gemini-3.8-flash（推荐）"],
  ["gpt-6-luna", "gpt-6-luna（最省，约 1/4 价）"],
  ["gpt-5.4-mini", "gpt-5.4-mini（约 2-3 倍价）"],
  ["gpt-6.1-sol", "gpt-6.1-sol（高准确，约 5 倍价）"],
  ["claude-sonnet-5-5", "claude-sonnet-5.5（最准也最贵）"],
  ["gpt-4.1-mini", "gpt-4.1-mini（旧默认）"]
];
export var MODEL2_OPTS = [
  ["", "不启用（默认）"],
  ["gpt-6-luna", "gpt-6-luna（推荐）"],
  ["gemini-3.8-flash", "gemini-3.8-flash（识别用 GPT 时选）"],
  ["claude-haiku-4-5-20251001", "claude-haiku-4.5"]
];
export function modelSelHtml(id, inId, opts, current) {
  var inList = opts.some(function (o) { return o[0] === current; });
  var st = 'style="width:100%;margin:6px 0 0;padding:10px;border:1px solid var(--hair);border-radius:8px;background:var(--card);color:inherit;font-size:14px"';
  var h = '<select id="' + id + '" data-modelsel="' + inId + '" ' + st + '>';
  opts.forEach(function (o) {
    h += '<option value="' + o[0] + '"' + (current === o[0] ? " selected" : "") + '>' + o[1] + '</option>';
  });
  var custom = !inList && current;
  h += '<option value="__custom"' + (custom ? " selected" : "") + '>自定义…</option></select>';
  h += '<input id="' + inId + '" type="text" autocomplete="off" placeholder="自定义模型名（以 ChatAnywhere 支持为准）" ' +
    'value="' + (custom ? esc(current) : "") + '" ' + st.slice(0, -1) + (custom ? '"' : ';display:none"') + '>';
  return h;
}

export function aiReady() { return !!(AI.key && AI.key.length > 8); }
/* 没密钥时点 AI 按钮：跳到「导出」页的密钥框，并在那里显示一行提示 */
export var aiKeyNudge = false;
export function aiNeedKey() {
  aiKeyNudge = true;
  switchTab("export");
  var inp = document.getElementById("ai-key-in");
  if (inp) { inp.scrollIntoView({ block: "center" }); inp.focus(); }
}


export function saveAiKey() {
  var inp = document.getElementById("ai-key-in");
  if (!inp) return;
  var v = inp.value.trim();
  if (v === "清除" || v.toLowerCase() === "clear") delete AI.key;
  else if (v) AI.key = v;
  /* 密钥框留空 = 不改密钥，这样单独换模型不用重贴密钥 */
  function pickModel(selId, inId) {
    var sel = document.getElementById(selId);
    if (!sel) return "";
    if (sel.value === "__custom") {
      var t = document.getElementById(inId);
      return t ? t.value.trim() : "";
    }
    return sel.value;
  }
  AI.model = pickModel("ai-model-sel", "ai-model-in") || AI_DEFAULT_MODEL;
  var m2 = pickModel("ai-model2-sel", "ai-model2-in");
  if (m2) AI.model2 = m2; else delete AI.model2;
  persist(AI_CFG_STORE, AI);
  renderExport();
}
export var AI_SYS_LABEL = "你是营养标签识别器。只输出一个 JSON 对象，不要任何其他文字、不要代码块标记。格式：" +
  '{"name":"品牌+食物名(中文)","per_100g":{"kcal":0,"protein":0,"fat":0,"carb":0},' +
  '"portions":[{"label":"整包","grams":0}],"default_portion":"整包",' +
  '"pack_grams":整包或每份的克数(标签没写就用null),"pack_kcal":同一份量对应的总热量(没写就用null),' +
  '"note":"哪些数字是标签实读、哪些是估算",' +
  '"read":{"kcal":true,"protein":true,"fat":true,"carb":true},' +
  '"search":"用包装上的原文写：品牌 产品全名 规格（如 Tesco Strawberry Compote with Granola and Greek Style Yogurt 180g），供上网查",' +
  '"barcode":"照片里看得清的条形码数字，看不到就用null"}。' +
  "规则：多张照片是同一个食物的不同面（外包装/成分表），合并成一条；per_100g 全部用每100克数值；" +
  "per_100g 只取标签上「每100克」那一列，不要取「每份」那一列；脂肪取总脂肪那一行（不是其中的饱和脂肪），碳水取总碳水那一行（不是其中的糖）；" +
  "标签只给千焦(kJ)时除以4.184换成kcal；pack_grams 和 pack_kcal 必须对应同一份量，照抄标签不要换算；" +
  "看不清或没有的字段按同类食物估算并在 note 里说明，同时在 read 里把这个字段标成 false（只有在标签上清楚读到的才标 true）；portions 给1-3个常用份量（整包/一份/半盒等，含克数）。";
export var AI_SYS_MEAL = "你是饮食热量估算器。用户给出一餐的照片或文字描述。只输出一个 JSON 对象，不要任何其他文字、不要代码块标记。格式：" +
  '{"items":[{"name":"食物名(中文)","grams":0,"per_100g":{"kcal":0,"protein":0,"fat":0,"carb":0}}],"note":"整体假设与不确定性"}。' +
  "规则：把这一餐拆成1-6样食物，每样给估计克数(grams)和每100克营养(per_100g)；多张照片属于同一餐；" +
  "照片里有营养成分表时优先用标签数值；克数按常见餐具和分量估；拿不准就取常见值并在 note 里说明。";
export var aiBusy = false;
export function aiRequest(model, sys, userContent) {
  var ctrl = ("AbortController" in window) ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 60000) : null;
  return fetch(AI.base + "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + AI.key },
    signal: ctrl ? ctrl.signal : undefined,
    /* 只给确认接受 temperature 0 的老型号传 0；gpt-5/6、o 系列、Claude Sonnet 5 起只接受默认值，传了会报错 */
    body: JSON.stringify(/^(gpt-4|gemini-2|claude-haiku-4)/.test(model) && !/search/.test(model)
      ? { model: model, temperature: 0, messages: [{ role: "system", content: sys }, { role: "user", content: userContent }] }
      : { model: model, messages: [{ role: "system", content: sys }, { role: "user", content: userContent }] })
  }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status + (r.status === 401 ? "（密钥无效？）" : ""));
    return r.json();
  }).then(function (j) {
    var txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) throw new Error("空回复");
    return txt;
  }).finally(function () { if (timer) clearTimeout(timer); });
}
/* onOk 可以返回 Promise（比如复核模型的第二次调用），「识别中」会一直显示到全部完成 */
export function aiChat(sys, userContent, onOk) {
  if (aiBusy) return;
  aiBusy = true;
  renderAiMod();   /* 真正发请求了才显示「识别中」 */
  var fellBack = null;
  aiRequest(AI.model, sys, userContent).catch(function (e) {
    /* 选的模型被服务方拒绝（下架、改名、不收图片等，都是 HTTP 4xx/5xx）就用老默认再试一次；
       密钥无效（401）和超时不重试 */
    var m = e && e.message ? e.message : "";
    if (AI.model === AI_FALLBACK_MODEL || !/^HTTP /.test(m) || /^HTTP 401/.test(m)) throw e;
    fellBack = m;
    return aiRequest(AI_FALLBACK_MODEL, sys, userContent);
  }).then(function (txt) {
    if (fellBack) alert("识别模型 " + AI.model + " 这次没调通（" + fellBack + "），已自动改用 " + AI_FALLBACK_MODEL +
      " 完成识别。老是这样的话，去「导出」页换个模型。");
    return onOk(txt);
  }).catch(function (e) {
    alert("AI 识别失败：" + (e && e.message ? e.message : e) + "\n可以先用「记一条估计」，回头再补。");
  }).finally(function () {
    aiBusy = false;
    renderAiMod();
  });
}

/* ── 标签没读全时上网补（v1.17.0，用户要求）─────────────────────────
   触发：识别模型说有字段没看清（read=false），或读数没通过算术自检。
   先用照片里读到的条形码查 Open Food Facts（免费）；查不到再让 ChatAnywhere 的联网搜索模型去找官网营养表
   （按次另收搜索费，只在没读全时才用）。只替换没看清的字段；读数自相矛盾而网上那份自洽时，四个数整套换成网上的。
   查不到就保留原来的估算，并在提示里说清楚。 */
export var AI_SEARCH_MODEL = "gpt-4o-mini-search-preview";   /* ChatAnywhere 最便宜的联网搜索模型（2026-10 价目页） */
export var AI_SYS_WEB = "你是营养数据查找员。用网络搜索找指定商品的营养成分表，优先超市官网或品牌官网，其次 Open Food Facts 等数据库。" +
  "只输出一个 JSON 对象，不要任何其他文字、不要代码块标记。格式：" +
  '{"found":true,"matched_name":"网页上的商品名","per_100g":{"kcal":0,"protein":0,"fat":0,"carb":0,"fiber":0},"pack_grams":null,"source":"网址"}。' +
  "规则：必须是同一品牌同一款商品，找不到就输出 {\"found\":false}，不要拿相似商品凑；per_100g 用每100克那一列；" +
  "脂肪取总脂肪、碳水取总碳水；只有千焦时除以4.184换成千卡。";

export function webFromBarcode(code) {
  if (!code) return Promise.resolve(null);
  return fetch("https://world.openfoodfacts.org/api/v2/product/" + code + ".json?fields=" + OFF_FIELDS).then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (j) {
    var sp = j && j.status === 1 && j.product ? offToSpec(j.product, code) : null;
    if (!sp || [sp.per_100g.protein, sp.per_100g.fat, sp.per_100g.carb].some(function (x) { return x == null; })) return null;
    return { per_100g: sp.per_100g, fiber: sp.extra.fiber || 0, src: "Open Food Facts 条形码 " + code + "（" + sp.name + "）" };
  }).catch(function () { return null; });
}
export function webFromSearch(spec) {
  var q = "商品：" + (spec.search || spec.name) + "\n中文名：" + spec.name +
    (spec.pack_grams ? "\n规格：" + spec.pack_grams + "g" : "") +
    (spec.unread.indexOf("kcal") < 0 ? "\n标签上读到每100克 " + spec.per_100g.kcal + " 千卡（可用来确认是不是同一款）" : "");
  return aiRequest(AI_SEARCH_MODEL, AI_SYS_WEB, q).then(webParse);
}
/* 返回 Promise；会直接改 spec 和 v（warns/oks） */
export function webFill(spec, v) {
  /* 页面原有的自检只抓差 30% 以上的大错；决定要不要上网查时收紧到 15%（看串行把饱和脂肪当脂肪，常常只差 20-30%） */
  var p0 = spec.per_100g, calc0 = 4 * p0.protein + 9 * p0.fat + 4 * p0.carb;
  var badRead = v.warns.length > 0 || (p0.kcal >= 40 && Math.abs(calc0 - p0.kcal) > Math.max(15, p0.kcal * 0.15));
  if (!spec.unread.length && !badRead) return Promise.resolve();
  var why = spec.unread.length ? "标签上没看清：" + spec.unread.map(function (k) {
    return { kcal: "热量", protein: "蛋白", fat: "脂肪", carb: "碳水" }[k]; }).join("、")
    : "照片读出的数自相矛盾（标 " + p0.kcal + " 千卡，按碳蛋脂算约 " + Math.round(calc0) + "）";
  var searchErr = null;
  return webFromBarcode(spec.barcode).then(function (w) {
    if (w) return w;
    return webFromSearch(spec).catch(function (e) { searchErr = e && e.message ? e.message : String(e); return null; });
  }).then(function (w) {
    if (!w) {
      v.warns.push(why + "，网上也没查到同款" + (searchErr ? "（联网搜索出错：" + searchErr + "）" : "") +
        "，这些数字是 AI 按同类食物估的");
      return;
    }
    var fields = spec.unread.slice();
    /* 读到的数自相矛盾、网上那份自洽：整套换成网上的 */
    if (badRead && webCheck(w.per_100g, w.fiber)) fields = ["kcal", "protein", "fat", "carb"];
    if (!fields.length) { v.warns.push("网上查到的另一份数据（" + w.src + "）：每100克 " + w.per_100g.kcal + " 千卡，可对照"); return; }
    fields.forEach(function (k) { spec.per_100g[k] = w.per_100g[k]; });
    var nm = fields.map(function (k) { return { kcal: "热量", protein: "蛋白", fat: "脂肪", carb: "碳水" }[k]; }).join("、");
    v.warns.push(why + "；" + nm + "已换成网上查到的数（来源：" + w.src + "），不是你拍的标签，有空对一下");
    v.warns = v.warns.filter(function (x) { return !/对不上|不一致/.test(x) || fields.length < 4; });
    spec.note = (spec.note + "；网上补：" + nm + "（" + w.src + "）").slice(0, 200);
  });
}
export function finishAddFood(spec, warns, oks) {
  var note = "AI 识别：" + spec.note;
  if (oks && oks.length) note += "；" + oks.join("；");
  if (warns.length) {
    note += "；⚠ " + warns.join("；");
    alert("入库成功，但有疑点：\n· " + warns.join("\n· "));
  }
  spec.note = note.slice(0, 300);
  aiAddFood(spec);
}

export function aiAddFood(spec) {
  /* finishAddFood 已经加过前缀，这里别再加一遍 */
  var nt = String(spec.note || "");
  if (nt.indexOf("AI 识别：") !== 0) nt = "AI 识别：" + nt;
  var f = { id: "uf-" + Date.now().toString(36), name: spec.name, per_100g: spec.per_100g,
            portions: spec.portions, default_portion: spec.default_portion,
            confidence: "low", note: nt.slice(0, 300), added: todayStr() };
  /* 从「扫码查不到 / 数据不对」转过来拍的成分表：记下条形码，下次扫直接出这条 */
  if (aiBarcode) { f.barcode = aiBarcode; aiBarcode = null; }
  USER_FOODS.push(f);
  persist(UF_KEY, USER_FOODS);
  openPortionSheet(f.id, null);
}

export var MEAL_DRAFT = null;
export function setMealDraft(v) { MEAL_DRAFT = v; }

export function textFoodFor(it, mealNote) {
  var key = normName(it.name);
  var hit = allFoods().filter(function (f) { return normName(f.name) === key; })[0];
  if (hit) return { food: hit, created: false };
  var g = Math.round(it.grams);
  var f = { id: "uf-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: it.name, per_100g: it.per_100g,
            portions: [{ label: "一份 " + g + "g", grams: g }], default_portion: "一份 " + g + "g",
            confidence: "low", added: todayStr(), src: "text",
            note: ("AI 文字估算：" + (mealNote || "数值按同类食物常见值估算")).slice(0, 300) };
  USER_FOODS.push(f);
  return { food: ufView(f), created: true };
}
export function mealItemKcal(it) { return it.grams > 0 ? Math.round(it.per_100g.kcal * it.grams / 100) : 0; }
export function mealTotal() {
  return MEAL_DRAFT ? MEAL_DRAFT.items.reduce(function (a, it) { return a + mealItemKcal(it); }, 0) : 0;
}
export function openMealSheet(meal) {
  MEAL_DRAFT = meal;
  var rows = meal.items.map(function (it, i) {
    return '<div class="mrow">' +
      '<input class="m-name" data-mname="' + i + '" value="' + esc(it.name) + '">' +
      '<input class="m-g" data-mg="' + i + '" type="number" inputmode="decimal" min="1" max="' + MAX_G + '" value="' + it.grams + '">' +
      '<span class="m-k" id="mk-' + i + '">' + mealItemKcal(it) + '</span>' +
      '<button class="m-x" data-act="meal-del" data-i="' + i + '" aria-label="删除此项">✕</button></div>';
  }).join("");
  openSheet(
    '<div class="sheet-h"><div class="nm">AI 估算 · 确认后才记录</div>' +
    '<div class="meta">名字和克数都可以改，热量跟着克数变。列：名称 · 克 · kcal</div></div>' +
    '<div class="sheet-b">' + rows +
      '<div class="rowline" style="margin-top:10px"><span class="k">合计</span><span class="v" id="meal-total">' + mealTotal() + ' kcal</span></div>' +
      (meal.note ? '<div class="note">AI 备注：' + esc(meal.note) + '</div>' : '') +
      '<button class="btn solid" data-act="meal-confirm" style="margin-top:8px">确认记录</button>' +
    '</div>');
}
export function mealRecalc() {
  if (!MEAL_DRAFT) return;
  MEAL_DRAFT.items.forEach(function (it, i) {
    var el = document.getElementById("mk-" + i);
    if (el) el.textContent = mealItemKcal(it);
  });
  var t = document.getElementById("meal-total");
  if (t) t.textContent = mealTotal() + " kcal";
}
export function aiEstimateMealText(q) {
  if (!q) { alert("先在输入框里描述这一餐（比如：鱼香肉丝盖饭+一罐可乐）。"); return; }
  aiChat(AI_SYS_MEAL, [{ type: "text", text: "这一餐是：" + q + "。按系统要求输出 JSON。" }], function (txt) {
    var meal = aiParseMeal(txt);
    if (!meal) { alert("AI 回复解析失败，描述再具体一点试试。"); return; }
    meal.src = "text";   /* 文字估算的每一项确认后都存进「我的食物」 */
    openMealSheet(meal);
  });
}
/* 拍照入口：label=成分表入库，meal=一餐估算；都支持多选（正面+背面/多角度） */
export var aiMode = "label";
export var aiBarcode = null;
export var aiInput = document.createElement("input");
aiInput.type = "file"; aiInput.accept = "image/*"; aiInput.multiple = true; aiInput.style.display = "none";
document.body.appendChild(aiInput);
export function aiPhotoStart(mode, barcode) {
  aiMode = mode;
  aiBarcode = (mode === "label" && barcode) ? barcode : null;
  aiInput.value = "";
  aiInput.click();
}
aiInput.addEventListener("change", function () {
  var files = Array.prototype.slice.call(aiInput.files || []).slice(0, 4);
  if (!files.length) return;
  var urls = [], done = 0;
  files.forEach(function (file, idx) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    function fin() { if (++done === files.length) aiPhotosReady(urls.filter(Boolean)); }
    img.onload = function () {
      var mx = 1280, sc = Math.min(1, mx / Math.max(img.width, img.height));
      var cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      urls[idx] = cv.toDataURL("image/jpeg", 0.85);
      fin();
    };
    img.onerror = function () { URL.revokeObjectURL(url); fin(); };
    img.src = url;
  });
});
export function aiPhotosReady(urls) {
  if (!urls.length) { alert("图片读取失败。"); renderAiMod(); return; }
  var content = urls.map(function (u) { return { type: "image_url", image_url: { url: u } }; });
  if (aiMode === "label") {
    content.push({ type: "text", text: "识别这个食物（" + urls.length + " 张照片为同一食物），按系统要求输出 JSON。" });
    aiChat(AI_SYS_LABEL, content, function (txt) {
      var spec = aiParseFood(txt);
      if (!spec) { alert("AI 回复解析失败，换张更清楚的照片试试。"); return; }
      var v = validateFoodSpec(spec);
      /* 没读全或读数自相矛盾 → 先上网补，再（可选）复核 */
      return webFill(spec, v).then(function () {
        if (!AI.model2) { finishAddFood(spec, v.warns, v.oks); return; }
        /* 可选的第二模型复核：同样的照片再读一遍，对比读数 */
        return aiRequest(AI.model2, AI_SYS_LABEL, content).then(function (txt2) {
          var spec2 = aiParseFood(txt2);
          if (spec2) {
            var d = compareSpecs(spec, spec2);
            if (d.length) v.warns = v.warns.concat(d); else v.oks.push("双模型复核一致");
          } else v.warns.push("复核模型回复无法解析，未完成复核");
          finishAddFood(spec, v.warns, v.oks);
        }).catch(function () {
          v.warns.push("复核模型调用失败，未完成复核");
          finishAddFood(spec, v.warns, v.oks);
        });
      });
    });
  } else {
    content.push({ type: "text", text: "估算这一餐（" + urls.length + " 张照片为同一餐），按系统要求输出 JSON。" });
    aiChat(AI_SYS_MEAL, content, function (txt) {
      var meal = aiParseMeal(txt);
      if (!meal) { alert("AI 回复解析失败，换张更清楚的照片试试。"); return; }
      openMealSheet(meal);
    });
  }
}


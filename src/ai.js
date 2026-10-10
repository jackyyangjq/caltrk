import Anthropic from "@anthropic-ai/sdk";
import { compareSpecs, validateFoodSpec, webCheck } from "./lib/checks.js";
import { SCHEMA_LABEL, SCHEMA_MEAL, aiErrText, imageBlock, replyText } from "./lib/claude.js";
import { OFF_FIELDS, aiParseFood, aiParseMeal, offToSpec, webParse } from "./lib/parse.js";
import { MAX_G, esc, normName, todayStr } from "./lib/util.js";
import { switchTab } from "./main.js";
import { openPortionSheet, openSheet } from "./sheets.js";
import { UF_KEY, USER_FOODS, allFoods, loadObj, persist, ufView } from "./store.js";
import { renderExport } from "./views/export.js";
import { renderAiMod } from "./views/today.js";

/* ── AI 识别（可选功能，BYOK：用户在「导出」页粘贴自己的 Anthropic API 密钥，
   仅保存在用户自己设备的浏览器存储中；页面用官方 SDK 从浏览器直连 api.anthropic.com，
   密钥不写入代码仓库、不包含在导出文件里，也不经过任何中间人）──────
   2026-10-10 v2.3（用户要求）：从 ChatAnywhere（OpenAI 兼容中转）整体换成 Claude API。
   识别、估算、联网补查都用 Sonnet 5.5；成分表可选用 Opus 5.5 再读一遍复核。 */
export var AI_CFG_STORE = "caltrk7f3a.ai.v1";
export var AI_MODEL = "claude-sonnet-5-5";
export var AI_MODEL_LABEL = "Claude Sonnet 5.5";
export var AI_REVIEW_MODEL = "claude-opus-5-5";
export var AI_REVIEW_LABEL = "Claude Opus 5.5";

export var AI = loadObj(AI_CFG_STORE);
/* 2026-10-10 一次性迁移：ChatAnywhere 的密钥（sk- 开头、不是 sk-ant-）在 Anthropic 用不了，清掉并记一笔，
   页面提示去重新填；旧的中转地址、模型名、复核模型、历次迁移标记一并清掉。 */
if (!AI.claude) {
  if (AI.key && !/^sk-ant-/.test(AI.key)) { delete AI.key; AI.oldKey = 1; }
  ["base", "model", "model2", "m41", "m26"].forEach(function (k) { delete AI[k]; });
  AI.claude = 1;
  persist(AI_CFG_STORE, AI);
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
  else if (v) {
    if (!/^sk-ant-/.test(v) && !confirm("这个密钥不是 sk-ant- 开头，不像 Anthropic 的 API 密钥（ChatAnywhere 的密钥在这里用不了）。仍然保存？")) return;
    AI.key = v;
    delete AI.oldKey;
  }
  /* 密钥框留空 = 不改密钥，这样单独开关复核不用重贴密钥 */
  var sel = document.getElementById("ai-model2-sel");
  if (sel && sel.value === AI_REVIEW_MODEL) AI.model2 = AI_REVIEW_MODEL; else delete AI.model2;
  persist(AI_CFG_STORE, AI);
  renderExport();
}
export var AI_SYS_LABEL = "你是营养标签识别器。只输出一个 JSON 对象，不要任何其他文字。格式：" +
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
export var AI_SYS_MEAL = "你是饮食热量估算器。用户给出一餐的照片或文字描述；文字可能是语音转写的，会有同音错字，按吃饭的语境理解。只输出一个 JSON 对象，不要任何其他文字。格式：" +
  '{"items":[{"name":"食物名(中文)","grams":0,"per_100g":{"kcal":0,"protein":0,"fat":0,"carb":0},' +
  '"portions":[{"label":"小碗","grams":0},{"label":"中碗","grams":0},{"label":"大碗","grams":0}]}],"note":"整体假设与不确定性"}。' +
  "规则：把这一餐拆成1-6样食物，每样给估计克数(grams)和每100克营养(per_100g)；多张照片属于同一餐；" +
  "照片里有营养成分表时优先用标签数值；克数按常见餐具和分量估；拿不准就取常见值并在 note 里说明；" +
  "portions 给 2-4 个这样东西常见的份量档位，用中国人习惯的说法（小碗/中碗/大碗、半盘/一盘、1 个/2 个、一片、一勺等），" +
  "每档写上克数，从小到大排，其中一档要和 grams 一致。";

/* 思考深度（effort）：读图和估份量要多想一点；纯文字估算和上网查找用 low，快、省 */
export var AI_EFFORT = { photo: "medium", text: "low", web: "low", review: "medium" };
/* 拒答回退：被安全分类器误拦时由服务端换模型重跑（beta，Anthropic 建议默认开；吃饭的照片基本碰不到） */
var FALLBACK_BETA = "server-side-fallback-2026-07-01";
var AI_TIMEOUT_MS = 60000, AI_WEB_TIMEOUT_MS = 120000;   /* 联网搜索要搜、要读网页，给长一点 */

var client = null, clientKey = null;
function claude() {
  if (!client || clientKey !== AI.key) {
    /* dangerouslyAllowBrowser：SDK 默认不让在网页里用（怕把站点自己的密钥泄露给访客）；
       这里的密钥是用户自己的、只在他自己的手机上，正是 BYOK 的用法 */
    client = new Anthropic({ apiKey: AI.key, baseURL: "https://api.anthropic.com", dangerouslyAllowBrowser: true,
                             maxRetries: 1, timeout: AI_TIMEOUT_MS });
    clientKey = AI.key;
  }
  return client;
}

/* 一次请求，返回回复里的文字（结构化输出时就是那段 JSON）。
   opts：schema 结构化输出；effort；tools 服务端工具（联网搜索）；timeout 毫秒；retry=false 不自动重试。
   SDK 默认会对超时、429、5xx、断网自动重试一次（见 claude()），所以最坏要等两倍 timeout。
   联网搜索在服务端循环太久会以 pause_turn 暂停，原样带上已有回复再发一次就能接着做（最多再续 2 次） */
export function aiRequest(model, sys, userContent, opts) {
  opts = opts || {};
  var oc = { effort: opts.effort || "medium" };
  if (opts.schema) oc.format = { type: "json_schema", schema: opts.schema };
  function send(messages, round) {
    var body = { model: model, max_tokens: 16000, system: sys, messages: messages, output_config: oc,
                 betas: [FALLBACK_BETA], fallbacks: "default" };
    if (opts.tools) body.tools = opts.tools;
    var ro = {};
    if (opts.timeout) ro.timeout = opts.timeout;
    if (opts.retry === false) ro.maxRetries = 0;
    return claude().beta.messages.create(body, ro).then(function (r) {
      if (r.stop_reason === "pause_turn" && round < 2) return send(messages.concat([{ role: "assistant", content: r.content }]), round + 1);
      return r;
    });
  }
  return send([{ role: "user", content: userContent }], 0).then(replyText);
}
export var aiBusy = false;
/* onOk 可以返回 Promise（比如复核模型的第二次调用），「识别中」会一直显示到全部完成。
   opts 同 aiRequest，另有 failHint：失败提示里加的一句 */
export function aiChat(sys, userContent, onOk, opts) {
  opts = opts || {};
  if (aiBusy) return;
  aiBusy = true;
  renderAiMod();   /* 真正发请求了才显示「识别中」 */
  aiRequest(AI_MODEL, sys, userContent, opts).then(function (txt) {
    return onOk(txt);
  }).catch(function (e) {
    alert("AI 识别失败：" + aiErrText(e, AI_TIMEOUT_MS / 1000) + "\n" + (opts.failHint || "可以先用「记一条估计」，回头再补。"));
  }).finally(function () {
    aiBusy = false;
    renderAiMod();
  });
}

/* ── 标签没读全时上网补（v1.17.0，用户要求）─────────────────────────
   触发：识别模型说有字段没看清（read=false），或读数没通过算术自检。
   先用照片里读到的条形码查 Open Food Facts（免费）；查不到再让 Claude 用服务端的联网搜索工具去找官网营养表
   （每次搜索另收费，只在没读全时才用）。只替换没看清的字段；读数自相矛盾而网上那份自洽时，四个数整套换成网上的。
   查不到就保留原来的估算，并在提示里说清楚。
   这一步不用结构化输出：搜索结果会带引用，接口不允许两者同时用；回复照旧由 webParse 从文字里抠出 JSON。 */
export var AI_WEB_TOOLS = [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }];
export var AI_SYS_WEB = "你是营养数据查找员。用网络搜索找指定商品的营养成分表，优先超市官网或品牌官网，其次 Open Food Facts 等数据库。" +
  "查完只输出一个 JSON 对象，不要任何其他文字、不要代码块标记。格式：" +
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
  return aiRequest(AI_MODEL, AI_SYS_WEB, q, { tools: AI_WEB_TOOLS, effort: AI_EFFORT.web, timeout: AI_WEB_TIMEOUT_MS, retry: false }).then(webParse);
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
    return webFromSearch(spec).catch(function (e) { searchErr = aiErrText(e, AI_WEB_TIMEOUT_MS / 1000); return null; });
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

/* 文字估算存进「我的食物」时的份量：AI 给的档位（≤3 个）里有和这次克数相同的就用它做默认，没有就补一个「一份 Ng」 */
export function textFoodPortions(it, g) {
  var ps = (it.portions || []).slice(0, 3);
  var hit = ps.filter(function (p) { return p.grams === g; })[0];
  if (!hit) { hit = { label: "一份 " + g + "g", grams: g }; ps = [hit].concat(ps.slice(0, 2)); }
  return { portions: ps, def: hit.label };
}
export function textFoodFor(it, mealNote) {
  var key = normName(it.name);
  var hit = allFoods().filter(function (f) { return normName(f.name) === key; })[0];
  if (hit) return { food: hit, created: false };
  var g = Math.round(it.grams), tp = textFoodPortions(it, g);
  var f = { id: "uf-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: it.name, per_100g: it.per_100g,
            portions: tp.portions, default_portion: tp.def,
            confidence: "low", added: todayStr(), src: "text",
            note: ("AI 文字估算：" + (mealNote || "数值按同类食物常见值估算")).slice(0, 300) };
  USER_FOODS.push(f);
  return { food: ufView(f), created: true };
}
export function mealItemKcal(it) { return it.grams > 0 ? Math.round(it.per_100g.kcal * it.grams / 100) : 0; }
export function mealTotal() {
  return MEAL_DRAFT ? MEAL_DRAFT.items.reduce(function (a, it) { return a + mealItemKcal(it); }, 0) : 0;
}
/* 份量档位：点一下把这一项的克数换成那一档 */
export function mealPortionChips(it, i) {
  if (!it.portions || !it.portions.length) return "";
  return '<div class="mport" id="mp-' + i + '">' + it.portions.map(function (p) {
    return '<button class="mp" data-act="meal-portion" data-i="' + i + '" data-g="' + p.grams + '" aria-pressed="' + (p.grams === it.grams) + '">' +
      esc(p.label) + ' <span>' + p.grams + 'g</span></button>';
  }).join("") + '</div>';
}
export function mealPickPortion(i, g) {
  var it = MEAL_DRAFT && MEAL_DRAFT.items[i];
  if (!it || !(g > 0)) return;
  it.grams = g;
  var inp = document.querySelector('[data-mg="' + i + '"]');
  if (inp) { inp.value = g; inp.classList.remove("bad"); }
  mealRecalc();
}
export function openMealSheet(meal) {
  MEAL_DRAFT = meal;
  var rows = meal.items.map(function (it, i) {
    return '<div class="mrow">' +
      '<input class="m-name" data-mname="' + i + '" value="' + esc(it.name) + '">' +
      '<input class="m-g" data-mg="' + i + '" type="number" inputmode="decimal" min="1" max="' + MAX_G + '" value="' + it.grams + '">' +
      '<span class="m-k" id="mk-' + i + '">' + mealItemKcal(it) + '</span>' +
      '<button class="m-x" data-act="meal-del" data-i="' + i + '" aria-label="删除此项">✕</button></div>' +
      mealPortionChips(it, i);
  }).join("");
  openSheet(
    '<div class="sheet-h"><div class="nm">AI 估算 · 确认后才记录</div>' +
    '<div class="meta">名字和克数都可以改，热量跟着克数变。列：名称 · 克 · kcal</div></div>' +
    '<div class="sheet-b" style="max-height:78vh;overflow-y:auto">' +
      (meal.heard ? '<div class="note">听到的是：「' + esc(meal.heard) + '」</div>' : '') + rows +
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
    var mp = document.getElementById("mp-" + i);
    if (mp) mp.querySelectorAll(".mp").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-g")) === it.grams)); });
  });
  var t = document.getElementById("meal-total");
  if (t) t.textContent = mealTotal() + " kcal";
}
/* 文字估算；fromVoice=true 时 q 是浏览器语音识别转出来的文字（voice.js），确认面板里显示「听到的是」 */
export function aiEstimateMealText(q, fromVoice) {
  if (!q) { alert("先在输入框里描述这一餐（比如：鱼香肉丝盖饭+一罐可乐）。"); return; }
  var text = fromVoice ? "这一餐是（语音转写，可能有同音错字）：" + q + "。按系统要求输出 JSON。" : "这一餐是：" + q + "。按系统要求输出 JSON。";
  aiChat(AI_SYS_MEAL, [{ type: "text", text: text }], function (txt) {
    var meal = aiParseMeal(txt);
    if (!meal) { alert(fromVoice ? "AI 没听明白，换个说法再试，或者用文字描述。" : "AI 回复解析失败，描述再具体一点试试。"); return; }
    meal.src = "text";   /* 文字和语音估算的每一项确认后都存进「我的食物」 */
    if (fromVoice) meal.heard = q.slice(0, 120);
    openMealSheet(meal);
  }, { schema: SCHEMA_MEAL, effort: AI_EFFORT.text });
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
  var content = urls.map(imageBlock);
  if (aiMode === "label") {
    content.push({ type: "text", text: "识别这个食物（" + urls.length + " 张照片为同一食物），按系统要求输出 JSON。" });
    aiChat(AI_SYS_LABEL, content, function (txt) {
      var spec = aiParseFood(txt);
      if (!spec) { alert("AI 回复解析失败，换张更清楚的照片试试。"); return; }
      var v = validateFoodSpec(spec);
      /* 没读全或读数自相矛盾 → 先上网补，再（可选）复核 */
      return webFill(spec, v).then(function () {
        if (AI.model2 !== AI_REVIEW_MODEL) { finishAddFood(spec, v.warns, v.oks); return; }
        /* 可选的第二模型复核：同样的照片让 Opus 再读一遍，对比读数 */
        return aiRequest(AI_REVIEW_MODEL, AI_SYS_LABEL, content, { schema: SCHEMA_LABEL, effort: AI_EFFORT.review }).then(function (txt2) {
          var spec2 = aiParseFood(txt2);
          if (spec2) {
            var d = compareSpecs(spec, spec2);
            if (d.length) v.warns = v.warns.concat(d); else v.oks.push("双模型复核一致");
          } else v.warns.push("复核模型回复无法解析，未完成复核");
          finishAddFood(spec, v.warns, v.oks);
        }).catch(function (e) {
          v.warns.push("复核模型调用失败（" + aiErrText(e, AI_TIMEOUT_MS / 1000) + "），未完成复核");
          finishAddFood(spec, v.warns, v.oks);
        });
      });
    }, { schema: SCHEMA_LABEL, effort: AI_EFFORT.photo });
  } else {
    content.push({ type: "text", text: "估算这一餐（" + urls.length + " 张照片为同一餐），按系统要求输出 JSON。" });
    aiChat(AI_SYS_MEAL, content, function (txt) {
      var meal = aiParseMeal(txt);
      if (!meal) { alert("AI 回复解析失败，换张更清楚的照片试试。"); return; }
      openMealSheet(meal);
    }, { schema: SCHEMA_MEAL, effort: AI_EFFORT.photo });
  }
}


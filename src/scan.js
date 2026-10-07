import { aiReady } from "./ai.js";
import { FOOD_LIBRARY, UF_SAME_AS } from "./data/foods.js";
import { scanChecks } from "./lib/checks.js";
import { OFF_FIELDS, gtinValid, normBarcode, offName, offToSpec, scanTokens } from "./lib/parse.js";
import { esc, todayStr } from "./lib/util.js";
import { elSheet, openPortionSheet, openSheet } from "./sheets.js";
import { DB, K, UF_KEY, USER_FOODS, allFoods, foodById, persist } from "./store.js";

/* ── 条形码（v1.15.0）─────────────────────────────────────
   识别：zxing-wasm 3.1.4（开源识别库，WebAssembly），文件放在本仓库 vendor/ 下，第一次点扫码才下载（约 1 MB）。
   iPhone 的浏览器没有自带条形码识别（BarcodeDetector 到 iOS 26 都不支持），所以统一走这个库。
   两种扫法：实时取景（getUserMedia）和拍一张照片识别（主屏幕图标里摄像头权限不稳时的退路）。
   查询：Open Food Facts（免费开放的食品数据库，网友录入）。查到后先给他核对，确认后存进「我的食物」并带
   barcode 字段，下次扫同一个商品直接从本地出结果；选了「用库里这条」的，关联记在 settings.barcode_map（随导出带出）。 */
export var ZX_BASE = "vendor/zxing-wasm-3.1.4/";
export var ZX_OPTS = { formats: ["EAN13", "EAN8", "UPCA", "UPCE"], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 1 };
/* 灰度转黑白的三种算法轮流试：默认的局部平均怕模糊，固定阈值怕光照不匀（2026-09-28 用合成照片实测，模糊图只有固定阈值认得出） */
export var ZX_BINS = ["LocalAverage", "FixedThreshold", "GlobalHistogram"];
export function zxOpts(i) { return Object.assign({}, ZX_OPTS, { binarizer: ZX_BINS[i % ZX_BINS.length] }); }
export var zxReady = null;
export function loadZX() {
  if (zxReady) return zxReady;
  zxReady = new Promise(function (res, rej) {
    var base = new URL(ZX_BASE, location.href).href;
    var s = document.createElement("script");
    s.src = base + "zxing-reader.js";
    s.onload = function () {
      if (!window.ZXingWASM) { rej(new Error("识别组件加载异常")); return; }
      ZXingWASM.prepareZXingModule({
        overrides: { locateFile: function (path, prefix) { return /\.wasm$/.test(path) ? base + path : prefix + path; } },
        fireImmediately: true
      }).then(function () { res(ZXingWASM); }, function () { rej(new Error("识别组件下载失败（网络？）")); });
    };
    s.onerror = function () { rej(new Error("识别组件下载失败（网络？）")); };
    document.head.appendChild(s);
  });
  zxReady.catch(function () { zxReady = null; });   /* 失败了下次点击重新下载 */
  return zxReady;
}


/* ── 扫法一：实时取景 ── */
export var scanSt = null;
export function scanMsg(t) { var m = document.getElementById("scan-msg"); if (m) m.textContent = t; }
export function scanLiveStart() {
  scanClose();
  var ov = document.createElement("div");
  ov.className = "scan-ov"; ov.id = "scan-ov";
  ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "扫条形码");
  ov.innerHTML = '<video muted playsinline autoplay></video><div class="frame" id="scan-frame"></div>' +
    '<div class="msg" id="scan-msg">正在打开摄像头…</div>' +
    '<div class="sbar"><button data-act="scan-torch" id="scan-torch" aria-pressed="false" style="display:none">手电筒</button>' +
    '<button data-act="scan-to-photo">改用拍照</button><button data-act="scan-cancel">取消</button></div>';
  document.body.appendChild(ov);
  var st = { stopped: false, last: "", timer: null, stream: null, video: ov.querySelector("video"), n: 0,
             cv: document.createElement("canvas"), torch: false };
  scanSt = st;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanMsg("这个浏览器打不开摄像头。点「改用拍照」，拍一张条形码照片来识别。");
    return;
  }
  /* 先在点击的同一拍里要摄像头，同时并行下载识别组件 */
  var cam = navigator.mediaDevices.getUserMedia({ audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
  Promise.all([cam, loadZX()]).then(function (r) {
    var stream = r[0];
    if (st.stopped) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    st.stream = stream;
    st.video.srcObject = stream;
    var p = st.video.play();
    if (p && p.catch) p.catch(function () {});
    var track = stream.getVideoTracks()[0];
    var caps = track && track.getCapabilities ? track.getCapabilities() : null;
    if (caps && caps.torch) document.getElementById("scan-torch").style.display = "";
    scanMsg("把条形码放进框里。太近对不上焦，离 15–25 厘米。");
    scanTick(st);
  }).catch(function (e) {
    cam.then(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); }, function () {});
    if (st.stopped) return;
    var denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    scanMsg(denied
      ? "没有拿到摄像头权限。可以点「改用拍照」；想用取景扫码，就在弹窗里点允许（被拒过的话去 iPhone 设置 → Safari → 相机 改成「询问」）。"
      : "打不开：" + (e && e.message ? e.message : e) + "。点「改用拍照」试试。");
  });
}
export function scanTick(st) {
  if (st.stopped) return;
  var v = st.video;
  if (v.readyState < 2 || !v.videoWidth) { st.timer = setTimeout(function () { scanTick(st); }, 150); return; }
  /* 只识别画面中间一条横带（比取景框略大），快也准 */
  var vw = v.videoWidth, vh = v.videoHeight;
  var cw = Math.round(vw * 0.9), ch = Math.round(Math.min(vh * 0.6, cw * 0.6));
  var sc = Math.min(1, 1000 / cw);
  st.cv.width = Math.round(cw * sc); st.cv.height = Math.round(ch * sc);
  var ctx = st.cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(v, (vw - cw) >> 1, (vh - ch) >> 1, cw, ch, 0, 0, st.cv.width, st.cv.height);
  var img = ctx.getImageData(0, 0, st.cv.width, st.cv.height);
  ZXingWASM.readBarcodes(img, zxOpts(st.n++)).then(function (rs) {
    if (st.stopped) return;
    var hit = (rs || []).filter(function (x) { return x.isValid && x.text; })[0];
    if (hit) {
      var code = normBarcode(hit.text);
      /* 同一个码读到两次才算数，防止偶尔误读 */
      if (code === st.last) {
        if (navigator.vibrate) navigator.vibrate(40);
        scanClose();
        lookupBarcode(code);
        return;
      }
      st.last = code;
      var fr = document.getElementById("scan-frame");
      if (fr) fr.classList.add("hit");
      scanMsg("读到 " + code + "，再稳住一下…");
    }
    st.timer = setTimeout(function () { scanTick(st); }, 90);
  }, function () {
    if (!st.stopped) st.timer = setTimeout(function () { scanTick(st); }, 300);
  });
}
export function scanTorch(btn) {
  var st = scanSt;
  if (!st || !st.stream) return;
  var track = st.stream.getVideoTracks()[0];
  st.torch = !st.torch;
  track.applyConstraints({ advanced: [{ torch: st.torch }] }).catch(function () { st.torch = !st.torch; });
  btn.setAttribute("aria-pressed", String(st.torch));
}
export function scanClose() {
  var st = scanSt;
  scanSt = null;
  if (st) {
    st.stopped = true;
    if (st.timer) clearTimeout(st.timer);
    if (st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); });
  }
  var ov = document.getElementById("scan-ov");
  if (ov) ov.parentNode.removeChild(ov);
}

/* ── 扫法二：拍一张照片识别（相册里现成的也行）── */
export var scanInput = document.createElement("input");
scanInput.type = "file"; scanInput.accept = "image/*"; scanInput.style.display = "none";
document.body.appendChild(scanInput);
export function scanPhotoStart() {
  scanInput.value = "";
  scanInput.click();
}
scanInput.addEventListener("change", function () {
  var file = scanInput.files && scanInput.files[0];
  if (!file) return;
  openSheet('<div class="sheet-h"><div class="nm">正在识别条形码…</div>' +
    '<div class="meta">第一次用要先下载识别组件（约 1 MB）</div></div><div class="sheet-b" data-bcwait="photo"></div>');
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    loadZX().then(function () {
      return decodeStill(img);
    }).then(function (code) {
      URL.revokeObjectURL(url);
      if (!elSheet.querySelector('[data-bcwait="photo"]')) return;   /* 等的时候他把面板关了 */
      if (code) lookupBarcode(code); else openScanFailSheet("照片里没认出条形码。");
    }).catch(function (e) {
      URL.revokeObjectURL(url);
      if (elSheet.querySelector('[data-bcwait="photo"]')) openScanFailSheet(e && e.message ? e.message : "识别出错。");
    });
  };
  img.onerror = function () { URL.revokeObjectURL(url); openScanFailSheet("图片读取失败。"); };
  img.src = url;
});
/* 先缩到长边 1600 识别（快）；认不出再用更高分辨率试（条形码拍得小的时候有用）；每个尺寸三种黑白算法都试 */
export function decodeStill(img) {
  var big = Math.max(img.naturalWidth, img.naturalHeight);
  var sizes = [1600];
  if (big > 1600) sizes.push(Math.min(big, 3000));
  var si = 0, bi = 0, data = null;
  function attempt() {
    if (!data) {
      var sc = Math.min(1, sizes[si] / big);
      var cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
      var ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      data = ctx.getImageData(0, 0, cv.width, cv.height);
    }
    return ZXingWASM.readBarcodes(data, zxOpts(bi)).then(function (rs) {
      var hit = (rs || []).filter(function (x) { return x.isValid && x.text; })[0];
      if (hit) return normBarcode(hit.text);
      if (++bi >= ZX_BINS.length) { bi = 0; data = null; if (++si >= sizes.length) return null; }
      return attempt();
    });
  }
  return attempt();
}
export function openScanFailSheet(why) {
  openSheet('<div class="sheet-h"><div class="nm">没扫出来</div><div class="meta">' + esc(why) + '</div></div>' +
    '<div class="sheet-b">' +
      '<div class="note">拍的时候让条形码占画面三分之一以上、横着放、别反光。也可以直接输条形码下面那串数字。</div>' +
      '<div class="field"><label>手动输入条形码数字</label>' +
      '<input id="in-bc" type="text" inputmode="numeric" autocomplete="off" placeholder="例如 5057753936686"></div>' +
      '<button class="btn solid" data-act="scan-manual-go">查询这个条形码</button>' +
      '<div class="scan-btns" style="margin-top:0"><button class="btn" data-act="scan-live">▥ 取景扫码</button>' +
      '<button class="btn plain" data-act="scan-photo">🖼 再拍一张</button></div>' +
    '</div>');
}

/* ── 查询：先本地，再 Open Food Facts ── */
export function barcodeLocal(code) {
  var map = DB.settings.barcode_map || {};
  if (map[code] && foodById(map[code])) return UF_SAME_AS[map[code]] || map[code];
  for (var i = USER_FOODS.length - 1; i >= 0; i--) {
    if (USER_FOODS[i].barcode === code) return UF_SAME_AS[USER_FOODS[i].id] || USER_FOODS[i].id;
  }
  for (var j = 0; j < FOOD_LIBRARY.length; j++) {
    var b = FOOD_LIBRARY[j].barcodes;   /* 正式条目可选字段：同一商品不同包装可能有几个码 */
    if (b && b.indexOf(code) >= 0) return FOOD_LIBRARY[j].id;
  }
  return null;
}
export var bcSeq = 0;
export function lookupBarcode(code) {
  var local = barcodeLocal(code);
  if (local) { openPortionSheet(local, null); return; }
  var seq = ++bcSeq;
  openSheet('<div class="sheet-h"><div class="nm">正在查询…</div><div class="meta">条形码 ' + esc(code) + ' · Open Food Facts</div></div>' +
    '<div class="sheet-b" data-bcwait="' + seq + '"></div>');
  function stillWaiting() { return seq === bcSeq && !!elSheet.querySelector('[data-bcwait="' + seq + '"]'); }
  var ctrl = ("AbortController" in window) ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
  fetch("https://world.openfoodfacts.org/api/v2/product/" + code + ".json?fields=" + OFF_FIELDS,
        { signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("数据库返回 HTTP " + r.status);
    return r.json();
  }).then(function (j) {
    if (!stillWaiting()) return;
    var prod = (j && j.status === 1 && j.product) ? j.product : null;
    var spec = prod ? offToSpec(prod, code) : null;
    if (spec) openScanResultSheet(spec);
    else openScanMissSheet(code, prod && (prod.product_name || prod.product_name_en || prod.generic_name) ? offName(prod, code) : null);
  }).catch(function (e) {
    if (!stillWaiting()) return;
    var msg = e && e.name === "AbortError" ? "查询超时（15 秒）" : (e && e.message ? e.message : "查询失败");
    openSheet('<div class="sheet-h"><div class="nm">没查成</div><div class="meta">条形码 ' + esc(code) + '</div></div>' +
      '<div class="sheet-b" data-bc="' + esc(code) + '"><div class="note">' + esc(msg) + '。要联网才能查新商品；扫过的商品以后不联网也能出。' +
      '这个数据库偶尔会慢几分钟（2026-09-28 实测过一次），过一会儿再查通常就好。</div>' +
      '<button class="btn solid" data-act="scan-retry">再查一次</button>' +
      (aiReady() ? '<button class="btn" data-act="scan-ai-label">📷 拍成分表入库</button>' : '') +
      '<button class="btn plain" data-act="scan-guess">先记一条估计</button></div>');
  }).finally(function () { if (timer) clearTimeout(timer); });
}

export function scanSuggest(name) {
  var a = scanTokens(name);
  if (a.length < 2) return [];
  return allFoods().map(function (f) {
    var b = scanTokens(f.name), common = a.filter(function (w) { return b.indexOf(w) >= 0; }).length;
    return { f: f, common: common, ratio: common / Math.max(1, Math.min(a.length, b.length)) };
  }).filter(function (x) { return x.common >= 2 && x.ratio >= 0.5; })
    .sort(function (x, y) { return y.common - x.common || y.ratio - x.ratio; })
    .slice(0, 2).map(function (x) { return x.f; });
}
export var SCAN_DRAFT = null;
export function setScanDraft(v) { SCAN_DRAFT = v; }
export function openScanResultSheet(spec) {
  SCAN_DRAFT = spec;
  var per = spec.per_100g, ex = spec.extra, u = spec.ml ? "ml" : "g";
  function inp(k, label) {
    return '<label>' + label + '<input data-sper="' + k + '" type="number" inputmode="decimal" min="0" step="0.1" value="' +
      (per[k] == null ? "" : per[k]) + '"' + (per[k] == null ? ' class="bad"' : '') + '></label>';
  }
  var sug = scanSuggest(spec.name).map(function (f) {
    return '<button class="p" data-act="scan-use-food" data-food="' + f.id + '"><span class="l">用库里这条：' + esc(f.name) + '</span>' +
      '<span class="g">每 100 g ' + f.per_100g.kcal + ' kcal · 蛋白 ' + f.per_100g.protein + ' g</span></button>';
  }).join("");
  var exTxt = [ex.fiber != null ? "纤维 " + ex.fiber + " g" : "纤维 无数据"].concat(
    ex.polyols ? ["糖醇 " + ex.polyols + " g"] : [], ex.alcohol ? ["酒精 " + ex.alcohol + " g"] : []).join(" · ");
  openSheet(
    '<div class="sheet-h"><div class="nm">扫码结果 · 核对后再存</div>' +
    '<div class="meta">条形码 ' + esc(spec.code) + ' · Open Food Facts（网友录入）</div></div>' +
    '<div class="sheet-b" data-bc="' + esc(spec.code) + '" style="max-height:78vh;overflow-y:auto">' +
      '<input class="s-name" id="in-sname" value="' + esc(spec.name) + '" aria-label="名称" maxlength="40">' +
      '<div class="hint">每 100 ' + u + ' 的数值，可以改：</div>' +
      '<div class="sgrid">' + inp("kcal", "热量 kcal") + inp("protein", "蛋白 g") + inp("fat", "脂肪 g") + inp("carb", "碳水 g") + '</div>' +
      '<div class="hint">' + exTxt + (spec.ml ? ' · 饮料按 1 ml ≈ 1 g 记' : '') + '</div>' +
      '<div id="scan-warn"></div>' +
      (sug ? '<div class="mod-title" style="margin:4px 0 0">库里可能是同一样东西</div>' + sug : '') +
      '<button class="btn solid" data-act="scan-save">存进我的食物 → 选份量</button>' +
      (aiReady() ? '<button class="btn" data-act="scan-ai-label">数据不对 → 拍成分表入库</button>' : '') +
    '</div>');
  scanWarnRefresh();
}
/* 读面板里四个数；有空的返回 null 值（由核对提示），超范围的标红 */
export function scanReadPer() {
  var per = {}, bad = false;
  [["kcal", 900], ["protein", 100], ["fat", 100], ["carb", 100]].forEach(function (d) {
    var el = elSheet.querySelector('[data-sper="' + d[0] + '"]');
    var raw = el ? el.value.trim() : "", v = parseFloat(raw);
    var ok = raw !== "" && v >= 0 && v <= d[1];
    if (el) el.classList.toggle("bad", !ok);
    if (raw !== "" && !ok) bad = true;
    per[d[0]] = ok ? (d[0] === "kcal" ? Math.round(v) : Math.round(v * 10) / 10) : null;
  });
  return { per: per, bad: bad };
}
export function scanWarnRefresh() {
  var box = document.getElementById("scan-warn");
  if (!box || !SCAN_DRAFT) return;
  var r = scanReadPer();
  var w = r.per.kcal == null ? ["热量要填"] : scanChecks(r.per, SCAN_DRAFT.extra);
  box.innerHTML = w.length ? '<div class="warnbox">⚠ ' + w.map(esc).join("<br>⚠ ") + '</div>'
                           : '<div class="warnbox ok">✓ 热量和碳蛋脂纤维对得上</div>';
}
export function scanSave() {
  if (!SCAN_DRAFT) return;
  var r = scanReadPer();
  if (r.bad || r.per.kcal == null) { scanWarnRefresh(); return; }
  var warns = scanChecks(r.per, SCAN_DRAFT.extra);
  var o = SCAN_DRAFT.per_100g, edited = ["kcal", "protein", "fat", "carb"].some(function (k) { return o[k] !== r.per[k]; });
  var per = { kcal: r.per.kcal, protein: r.per.protein || 0, fat: r.per.fat || 0, carb: r.per.carb || 0 };
  if (SCAN_DRAFT.extra.fiber != null) per.fiber = SCAN_DRAFT.extra.fiber;
  var nmEl = document.getElementById("in-sname");
  var name = (nmEl && nmEl.value.trim()) || SCAN_DRAFT.name;
  var note = "条形码 " + SCAN_DRAFT.code + " · Open Food Facts" + (edited ? "（数值手动改过）" : "") +
    (warns.length ? "；⚠ " + warns.join("；") : "；算术核对通过");
  var f = { id: "uf-" + Date.now().toString(36), name: name.slice(0, 40), per_100g: per,
            portions: SCAN_DRAFT.portions, default_portion: SCAN_DRAFT.default_portion,
            confidence: warns.length ? "low" : "high", note: note.slice(0, 300), added: todayStr(),
            src: "barcode", barcode: SCAN_DRAFT.code };
  USER_FOODS.push(f);
  persist(UF_KEY, USER_FOODS);
  SCAN_DRAFT = null;
  openPortionSheet(f.id, null);
}
export function scanUseFood(code, foodId) {
  if (!code || !foodById(foodId)) return;
  if (!DB.settings.barcode_map) DB.settings.barcode_map = {};
  DB.settings.barcode_map[code] = foodId;
  persist(K.settings, DB.settings);
  SCAN_DRAFT = null;
  openPortionSheet(foodId, null);
}
export function openScanMissSheet(code, name) {
  openSheet('<div class="sheet-h"><div class="nm">' + (name ? esc(name) : "数据库里没有这个商品") + '</div>' +
    '<div class="meta">条形码 ' + esc(code) + (name ? ' · 有这个商品，但没有营养数据' : ' · Open Food Facts 查不到') + '</div></div>' +
    '<div class="sheet-b" data-bc="' + esc(code) + '">' +
      (aiReady()
        ? '<button class="btn solid" data-act="scan-ai-label">📷 拍成分表入库</button>' +
          '<div class="hint">入库时会记下这个条形码，下次扫直接出结果。</div>'
        : '<div class="note">到「导出」页保存 AI 密钥后，这里可以直接拍成分表入库。</div>') +
      '<button class="btn" data-act="scan-guess">先记一条估计</button>' +
    '</div>');
}
export function scanManualGo(raw) {
  var code = normBarcode(raw);
  if (!/^\d{8,14}$/.test(code)) { alert("条形码是 8 到 14 位数字。"); return; }
  if (!gtinValid(code) && !confirm("这串数字的校验位对不上，可能输错了一位。仍然去查？")) return;
  lookupBarcode(code);
}

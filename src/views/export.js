import { AI, AI_DEFAULT_MODEL, MODEL2_OPTS, MODEL_OPTS, aiKeyNudge, aiReady, modelSelHtml } from "../ai.js";
import { BUILD } from "../build.js";
import { mergeMissing } from "../lib/backup.js";
import { nowTs, todayStr } from "../lib/util.js";
import { VIEWS, activeTab } from "../main.js";
import { DB, K, UF_KEY, USER_FOODS, loadArr, persist, reloadDB, setUserFoods, storeBroken } from "../store.js";
import { daysSinceExport, renderBanner } from "./today.js";


/* ── 导出页 ─────────────────────────────────────────────── */
export function renderExport() {
  var el = document.getElementById("view-export");
  var completeDays = DB.days.filter(function (d) { return d.complete; }).length;
  var lastConfirm = DB.settings.last_export_confirm || null;
  var ds = daysSinceExport();
  var staleCls = (ds != null && ds > 7) ? " warn" : "";
  el.innerHTML =
    '<div class="mod"><div class="mod-title">数据</div>' +
    '<div class="rowline"><span class="k">摄入记录</span><span class="v">' + DB.log.length + ' 条</span></div>' +
    '<div class="rowline"><span class="k">体重记录</span><span class="v">' + DB.weight.length + ' 次</span></div>' +
    '<div class="rowline"><span class="k">标记完整的天</span><span class="v">' + completeDays + ' 天</span></div>' +
    '<div class="rowline"><span class="k">上次导出确认</span><span class="v' + staleCls + '">' +
      (lastConfirm ? lastConfirm + (ds > 0 ? "（" + ds + " 天前）" : "") : "从未") + '</span></div>' +
    (storeBroken ? '<div class="note" style="color:var(--over)">⚠️ 检测到存储异常。导出文件里已附带抢救出的原始数据，请尽快导出并联系分析端。</div>' : '') +
    '</div>' +
    '<div class="mod"><div class="mod-title">AI 识别（自带密钥）</div>' +
    (aiKeyNudge && !aiReady() ? '<div class="warnbox">先在下面粘贴 ChatAnywhere 密钥、点「保存设置」，再回「今日」页拍照或估算。</div>' : '') +
    '<div class="rowline"><span class="k">状态</span><span class="v">' +
      (aiReady() ? "已启用 · " + AI.model : "未设置") + '</span></div>' +
    '<input id="ai-key-in" type="password" autocomplete="off" placeholder="粘贴密钥（留空=不改；输「清除」=删掉）" ' +
      'style="width:100%;margin:8px 0 0;padding:10px;border:1px solid var(--hair);border-radius:8px;background:var(--card);color:inherit;font-size:14px">' +
    '<div class="rowline" style="margin-top:10px"><span class="k">识别模型</span></div>' +
    modelSelHtml("ai-model-sel", "ai-model-in", MODEL_OPTS, AI.model || AI_DEFAULT_MODEL) +
    '<div class="rowline" style="margin-top:10px"><span class="k">复核模型（可选）</span></div>' +
    modelSelHtml("ai-model2-sel", "ai-model2-in", MODEL2_OPTS, AI.model2 || "") +
    '<button class="btn solid" data-act="save-ai-key" style="margin-top:10px">保存设置</button>' +
    '<div class="note">密钥只存在这台手机的浏览器里：不进导出文件、不进代码仓库，页面从手机直连 ChatAnywhere。' +
    '列表按花费从低到高排，价格是和原默认 gpt-4.1-mini 比；日常用默认的 gemini-3.8-flash 就好（新一代、价钱差不多，一次识别约 1-3 分钱）。复核模型最好和识别模型不同厂商。选的模型调不通时会自动用 gpt-4.1-mini 再试一次，' +
    '标签特别小或印刷差再换更强的。复核模型选一个后，成分表入库会用两个模型各读一遍、不一致时提醒' +
    '（费用×2，仍是几分钱级）。成分表没拍清时，会先按照片里的条形码查免费数据库，查不到再用联网搜索模型去网上找同款的官方营养表，把没看清的数字补上（联网搜索按次另收费，只在没读全时才用）。另外每次入库都自动做免费的算术交叉验证（整包热量 vs 每100g×重量、热量 vs 碳蛋脂）。</div></div>' +
    '<div class="mod"><button class="btn solid" data-act="do-export">导出全部数据</button>' +
    '<div class="note">每周一次。文件会出现在「文件」App 的下载项里，' +
    '打开 OneDrive 把它移到 <b style="font-family:var(--f-num)">健康数据/calorie-tracker/exports/</b>。' +
    '这是唯一的备份——手机丢了或清了浏览器数据，没导出的部分就没了。</div></div>' +
    '<div class="mod"><div class="mod-title">从备份导入</div>' +
    '<button class="btn" data-act="do-import">选择备份文件（.json）</button>' +
    '<div class="note">换了网址或换了手机时用：在「文件」App 里进 OneDrive → 健康数据/calorie-tracker/exports/，选最新的「热量日志-日期.json」。' +
    '只补上这台手机没有的记录，已有的不改不删，重复导入同一个文件也不会记重。AI 密钥不在备份里，要在上面重新填。</div></div>' +
    '<div class="footver">热量记录 v' + BUILD.version + ' · ' + BUILD.built + (storeBroken ? " · ⚠️ 存储异常" : "") + '</div>';
}
/* ── 从备份导入（v1.15.0）───────────────────────────────
   2026-09-28 GitHub 用户名改了，网址从 jackieyangjq.github.io 变成 jackyyangjq.github.io，
   手机浏览器按网址分开存数据，新网址是空的，所以要能把导出文件读回来。
   只补这台手机没有的（按 id / 日期+场景 / 日期 / 食物 id 判断），已有的一条不改不删。
   导完 reloadDB 会把 LOG_FIX 补到旧备份里还没更正过的流水上。 */
export var importInput = document.createElement("input");
importInput.type = "file"; importInput.accept = ".json,application/json"; importInput.style.display = "none";
document.body.appendChild(importInput);
importInput.addEventListener("change", function () {
  var file = importInput.files && importInput.files[0];
  if (!file) return;
  var rd = new FileReader();
  rd.onload = function () { importBackup(String(rd.result)); };
  rd.onerror = function () { alert("文件读取失败。"); };
  rd.readAsText(file);
});

export function importBackup(txt) {
  var d;
  try { d = JSON.parse(txt); } catch (e) { alert("这不是有效的备份文件（读不懂里面的内容）。"); return; }
  if (!d || d.schema !== "caltrk-export.v1" || !Array.isArray(d.log)) { alert("这不是热量记录导出的备份文件。"); return; }
  if (storeBroken) { alert("本机存储异常，先别导入：请先导出现有数据。"); return; }
  reloadDB(); setUserFoods(loadArr(UF_KEY));   /* 以存储里最新的为准 */
  var nx = { log: DB.log.slice(), weight: DB.weight.slice(), days: DB.days.slice(), training: DB.training.slice(), uf: USER_FOODS.slice() };
  var c = {
    log: mergeMissing(nx.log, d.log, function (e) { return e.id || null; }),
    weight: mergeMissing(nx.weight, d.weight, function (w) { return w.date ? w.date + "|" + w.context : null; }),
    days: mergeMissing(nx.days, d.days, function (x) { return x.date || null; }),
    training: mergeMissing(nx.training, d.training, function (x) { return x.date || null; }),
    uf: mergeMissing(nx.uf, d.user_foods, function (f) { return f.id || null; })
  };
  /* 设置：流水更正记账取并集，条形码关联补缺，其余只补这台手机没有的键 */
  var st = JSON.parse(JSON.stringify(DB.settings)), stN = 0, ds = d.settings;
  if (ds && typeof ds === "object" && !Array.isArray(ds)) {
    Object.keys(ds).forEach(function (k) {
      if (k === "log_fix_done" && Array.isArray(ds[k])) {
        var have = Array.isArray(st[k]) ? st[k] : [];
        ds[k].forEach(function (x) { if (have.indexOf(x) < 0) { have.push(x); stN++; } });
        st[k] = have;
      } else if (k === "barcode_map" && ds[k] && typeof ds[k] === "object") {
        if (!st[k]) st[k] = {};
        Object.keys(ds[k]).forEach(function (b) { if (!st[k][b]) { st[k][b] = ds[k][b]; stN++; } });
      } else if (!(k in st)) { st[k] = ds[k]; stN++; }
    });
  }
  if (!st.last_export_confirm && d.exported_at) { st.last_export_confirm = d.exported_at; stN++; }
  var total = c.log + c.weight + c.days + c.training + c.uf;
  if (!total) { alert("备份里的记录这台手机都有了，不用导入。"); return; }
  if (!confirm("备份导出于 " + (d.exported_at || "?") + "（v" + (d.app_version || "?") + "）。\n" +
      "会补上这台手机没有的：\n· 摄入记录 " + c.log + " 条\n· 体重 " + c.weight + " 次\n· 记全标记 " + c.days +
      " 天\n· 训练 " + c.training + " 天\n· 我的食物 " + c.uf + " 个\n已有的记录一条都不改。导入？")) return;
  /* 按时间排好：「上次克数」等功能从后往前找最近一条 */
  nx.log.sort(function (a, b) { return (a.ts || "") < (b.ts || "") ? -1 : (a.ts || "") > (b.ts || "") ? 1 : 0; });
  persist(K.log, nx.log);
  persist(K.weight, nx.weight);
  persist(K.days, nx.days);
  persist(K.training, nx.training);
  persist(UF_KEY, nx.uf);
  persist(K.settings, st);
  reloadDB(); setUserFoods(loadArr(UF_KEY));
  VIEWS[activeTab()]();
  renderBanner();
  alert(storeBroken ? "导入时存储写入失败，请截图并联系分析端。" :
    "导入完成：现在共 " + DB.log.length + " 条摄入记录、" + DB.weight.length + " 次体重。" +
    (aiReady() ? "" : "\nAI 密钥不在备份里，记得在这一页重新填。"));
}
export function doExport() {
  var payload = {
    schema: "caltrk-export.v1",
    exported_at: nowTs(),
    app_version: BUILD.version,
    log: DB.log, weight: DB.weight, days: DB.days, training: DB.training,
    user_foods: USER_FOODS,
    settings: DB.settings   /* v1.15.0 起带上：条形码关联、已做过的流水更正等。AI 密钥不在这里，不会导出 */
  };
  /* 附带解析失败时抢救下来的原始串，供电脑侧恢复 */
  var baks = {};
  [K.log, K.weight, K.days, K.settings, K.training, UF_KEY].forEach(function (k) {
    try {
      var b = localStorage.getItem(k + ".bak");
      if (b != null) baks[k] = b;
    } catch (e) {}
  });
  if (Object.keys(baks).length) payload.corrupt_backups = baks;
  var name = "热量日志-" + todayStr() + ".json";
  var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" }));
  var a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  /* 仅记「导出确认」；文件是否真到了 OneDrive 由电脑侧核对（设计 §4.7） */
  DB.settings.last_export_confirm = nowTs();
  persist(K.settings, DB.settings);
  renderExport();
}

// Scripted walk through every screen and flow of the app. Returns one snapshot per step
// (page DOM, open sheet, toast, localStorage, dialogs, downloads) so two builds can be diffed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NOW, buildFixture, INIT_SCRIPT, MOCK } from "./fixture.mjs";

const ICON = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../apple-touch-icon.png");

export async function runScenario(browser, baseUrl) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 400, height: 860 } });
  const page = await ctx.newPage();
  const snaps = [], dialogs = [], errors = [];
  page.on("dialog", d => { dialogs.push(d.type() + ": " + d.message()); d.accept(); });
  page.on("pageerror", e => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(INIT_SCRIPT);
  await page.route("https://api.chatanywhere.org/**", async route => {
    const body = route.request().postDataJSON();
    const sys = body.messages[0].content;
    const content = /营养数据查找员/.test(sys) ? MOCK.web : /营养标签识别器/.test(sys) ? MOCK.label : MOCK.meal;
    await route.fulfill({ json: { choices: [{ message: { content } }] } });
  });
  await page.route("https://world.openfoodfacts.org/**", async route => {
    if (route.request().url().includes("5057753936686")) await route.fulfill({ json: MOCK.off });
    else await route.fulfill({ status: 404, json: { status: 0 } });
  });

  // Seed storage on the app's origin, then load the app.
  await page.goto(baseUrl + "apple-touch-icon.png");
  const fx = buildFixture();
  await page.evaluate(fx => { localStorage.clear(); for (const k in fx) localStorage.setItem(k, fx[k]); }, fx);
  await page.goto(baseUrl);
  await page.waitForTimeout(300);

  const norm = s => String(s).replace(/热量记录 v[\d.]+/g, "热量记录 vX").replace(/"app_version":\s*"[\d.]+"/g, '"app_version":"X"');
  async function snap(step) {
    await page.waitForTimeout(120);
    const s = await page.evaluate(() => {
      const ls = {};
      Object.keys(localStorage).sort().forEach(k => { ls[k] = localStorage.getItem(k); });
      const t = document.querySelector(".toast");
      const ov = document.querySelector(".scan-ov");
      return { dom: document.querySelector(".page").innerHTML, tabs: document.querySelector(".tabs").innerHTML,
        sheet: document.getElementById("backdrop").className + "|" + document.getElementById("sheet").innerHTML,
        toast: t ? t.innerHTML : "", scan: ov ? ov.innerHTML : "", ls };
    });
    s.dom = norm(s.dom);
    s.ls = norm(JSON.stringify(s.ls));
    s.dialogs = dialogs.splice(0);
    snaps.push({ step, ...s });
  }
  const click = async sel => { await page.locator(sel).first().click(); };
  const typeIn = async (sel, text) => { await page.locator(sel).first().fill(text); };

  await snap("load");
  await click('.chip[data-act="quick-log"]'); await snap("quick-log");
  await click('.toast [data-toast="undo"]'); await snap("undo");
  await click('.chip[data-act="quick-log"]'); await click('.toast [data-toast="edit"]'); await snap("toast-edit");
  await click('[data-act="pick-portion"]'); await snap("pick-portion");
  const last = page.locator('[data-act="quick-log-last"]');
  if (await last.count()) { await last.first().click(); await snap("quick-log-last"); }
  await click('[data-act="quick-combo"]'); await snap("combo");
  await click('.toast [data-toast="undo"]'); await snap("combo-undo");

  await typeIn("#in-search", "tesco"); await snap("search");
  await click('.r-item[data-act="open-food"]'); await snap("portion-sheet");
  await typeIn("#in-grams", "123"); await snap("grams-preview");
  await click('[data-act="confirm-grams"]'); await snap("confirm-grams");

  await typeIn("#in-search", "鸡胸"); await snap("search-generic");
  await click('.r-sec ~ .r-item[data-act="open-food"]'); await snap("generic-sheet");
  await click('[data-act="pick-portion"]'); await snap("generic-logged");
  await typeIn("#in-search", "奇怪的东西"); await snap("search-miss");
  await click('[data-act="open-guess"]'); await snap("guess-sheet");
  await typeIn("#in-gkcal", "333"); await click('[data-act="pick-amount"][data-a="一半"]');
  await click('[data-act="confirm-guess"]'); await snap("guess-saved");

  const items = page.locator('[data-act="edit-entry"]');
  const n = await items.count();
  for (let i = 0; i < n; i++) { await items.nth(i).click(); await snap("edit-entry-" + i); await page.mouse.click(200, 20); await page.waitForTimeout(350); }
  await items.first().click(); await click('[data-act="delete-entry"]'); await snap("delete-armed");
  await click('[data-act="delete-entry"]'); await snap("deleted");

  await click('[data-act="toggle-complete"]'); await snap("complete");
  await click('[data-act="toggle-training"][data-type="incline"]'); await snap("training");
  await page.locator('[data-tmin="incline"]').fill("60"); await snap("training-slider");
  await page.locator('[data-tmin="incline"]').dispatchEvent("change"); await snap("training-change");
  await click('[data-act="hist-toggle"]'); await snap("hist-14");
  await page.locator('[data-act="view-day"]').nth(3).click(); await snap("view-past");
  await click('.chip[data-act="quick-log"]'); await snap("past-quick-log");
  await page.locator('[data-act="edit-entry"]').first().click(); await snap("past-edit");
  await page.mouse.click(200, 20); await page.waitForTimeout(350);
  await click('[data-act="back-today"]'); await snap("back-today");

  // AI: text estimate
  await typeIn("#ai-meal-text", "番茄炒蛋盖饭"); await click('[data-act="ai-meal-text"]'); await page.waitForTimeout(400); await snap("ai-text-sheet");
  await page.locator('[data-mg="0"]').fill("250"); await snap("ai-text-grams");
  await click('[data-act="meal-portion"][data-i="1"][data-g="250"]'); await snap("ai-text-portion");
  await page.locator('[data-mname="1"]').fill("白米饭"); await click('[data-act="meal-confirm"]'); await snap("ai-text-confirm");
  // AI: meal photo
  let fc = page.waitForEvent("filechooser"); await click('[data-act="ai-meal-photo"]');
  await (await fc).setFiles([ICON]); await page.waitForTimeout(600); await snap("ai-photo-sheet");
  await click('[data-act="meal-del"][data-i="1"]'); await snap("ai-photo-del");
  await click('[data-act="meal-confirm"]'); await snap("ai-photo-confirm");
  // AI: label photo -> web fill -> portion sheet
  fc = page.waitForEvent("filechooser"); await click('[data-act="ai-label-photo"]');
  await (await fc).setFiles([ICON, ICON]); await page.waitForTimeout(800); await snap("ai-label");
  await click('[data-act="pick-portion"]'); await snap("ai-label-logged");

  // Barcode via search digits -> OFF hit -> edit -> save
  await typeIn("#in-search", "5057753936686"); await snap("search-digits");
  await click('[data-act="scan-code"]'); await page.waitForTimeout(400); await snap("scan-result");
  await page.locator('[data-sper="fat"]').fill("6"); await page.locator('[data-sper="fat"]').dispatchEvent("input"); await snap("scan-edit");
  await click('[data-act="scan-save"]'); await snap("scan-saved");
  await click('[data-act="pick-portion"]'); await snap("scan-logged");
  await typeIn("#in-search", "5057753936686"); await click('[data-act="scan-code"]'); await page.waitForTimeout(300); await snap("scan-local");
  await page.mouse.click(200, 20); await page.waitForTimeout(350);
  await typeIn("#in-search", "5000119000013"); await click('[data-act="scan-code"]'); await page.waitForTimeout(300); await snap("scan-miss");
  await page.mouse.click(200, 20); await page.waitForTimeout(350);
  await typeIn("#in-search", "5000119000006"); await click('[data-act="scan-code"]'); await page.waitForTimeout(300); await snap("scan-userfood");
  await page.mouse.click(200, 20); await page.waitForTimeout(350);
  await typeIn("#in-search", ""); await page.locator("#in-search").dispatchEvent("input");

  // Weight tab
  await click('.tabs [data-tab="weight"]'); await snap("weight");
  await click('[data-act="trend-range"][data-r="14"]'); await snap("trend-14");
  const box = await page.locator("#trchart").boundingBox();
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5); await snap("trend-tap");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); await snap("trend-keys");
  await click('[data-act="trend-range"][data-r="all"]'); await snap("trend-all");
  await click(".tr-table summary"); await snap("trend-table");
  await click('[data-act="trend-range"][data-r="30"]');
  await click('[data-act="ctx-gym"]'); await snap("weight-gym");
  await click('[data-act="kg-plus"]'); await click('[data-act="kg-plus"]'); await snap("weight-step");
  await click('[data-act="save-weight"]'); await snap("weight-saved");
  await click('[data-act="ctx-morning"]'); await typeIn("#in-kg", "81.4"); await page.locator("#in-kg").dispatchEvent("input");
  await click('[data-act="save-weight"]'); await snap("weight-morning");

  // Library tab
  await click('.tabs [data-tab="library"]'); await snap("library");
  await typeIn("#in-lib", "tesco"); await snap("library-search");
  await typeIn("#in-lib", "豆腐"); await snap("library-search-generic");
  await typeIn("#in-lib", ""); await click('[data-act="del-userfood"]'); await snap("library-del-armed");
  await click('[data-act="del-userfood"][data-armed]'); await snap("library-deleted");
  await click('.r-item[data-act="open-food"]'); await snap("library-open");
  await page.mouse.click(200, 20); await page.waitForTimeout(350);

  // Export tab: settings, export, import
  await click('.tabs [data-tab="export"]'); await snap("export");
  await page.locator("#ai-model-sel").selectOption("__custom"); await snap("model-custom");
  await typeIn("#ai-model-in", "my-model"); await page.locator("#ai-model2-sel").selectOption("gpt-6-luna");
  await click('[data-act="save-ai-key"]'); await snap("model-saved");
  const dl = page.waitForEvent("download"); await click('[data-act="do-export"]');
  const d = await dl; const exported = fs.readFileSync(await d.path(), "utf8");
  await snap("exported");
  snaps[snaps.length - 1].download = d.suggestedFilename() + "\n" + norm(exported);
  const bk = JSON.parse(exported);
  bk.app_version = "1.0"; bk.exported_at = "2026-10-01T10:00";
  bk.log.push({ id: "imp1", ts: "2026-09-01T08:00", food_id: "banana", name: "香蕉（去皮）", portion: "1 根（中）", grams: 118, kcal: 105, protein: 1.3, fat: 0.4, carb: 26.9, confidence: "low", pending: false });
  bk.weight.push({ date: "2026-09-01", kg: 84.0, context: "morning" });
  bk.settings = { log_fix_done: ["zzz"], barcode_map: { "123": "banana" }, newkey: 1 };
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "caltrk-")), "bk.json");
  fs.writeFileSync(tmp, JSON.stringify(bk));
  fc = page.waitForEvent("filechooser"); await click('[data-act="do-import"]');
  await (await fc).setFiles([tmp]); await page.waitForTimeout(400); await snap("imported");
  await click('.tabs [data-tab="today"]'); await snap("today-after-import");

  // Scan overlay (camera unavailable in headless: shows its message) and cancel
  await click('[data-act="scan-live"]'); await page.waitForTimeout(400); await snap("scan-live");
  await click('[data-act="scan-cancel"]'); await snap("scan-cancel");
  // Banner dismiss
  const x = page.locator('[data-act="dismiss-banner"]');
  if (await x.count()) { await x.first().click(); await snap("banner-dismissed"); }

  snaps.push({ step: "errors", errors });
  await ctx.close();
  return snaps;
}

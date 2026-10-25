// Quick record (v2.4): the user decides what is in it. Checks first-run seeding from the old auto list,
// edit mode (remove / pin / hide, chips can't log while editing), auto-fill never bringing back removed foods,
// the toggles in search results, the food library and the portion sheet, generic foods, merged foods,
// and that the choice survives a reload. Usage: node tests/e2e/quick.mjs <url>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { NOW, buildFixture } from "./fixture.mjs";

const url = process.argv[2];
const SETTINGS = "caltrk7f3a.settings.v1";
const fail = m => { console.log("FAIL:", m); process.exitCode = 1; };
const browser = await chromium.launch();
const errors = [];

async function open(fx) {
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());
  await page.clock.setFixedTime(new Date(NOW));
  await page.route("https://world.openfoodfacts.org/**", r => r.fulfill({ status: 404, json: { status: 0 } }));
  await page.goto(url + "apple-touch-icon.png");
  await page.evaluate(fx => { localStorage.clear(); for (const k in fx) localStorage.setItem(k, fx[k]); }, fx);
  await page.goto(url);
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).quick, SETTINGS);   // seeded once generic foods load
  return page;
}
const quick = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).quick, SETTINGS);
// What the quick-record block shows: [food id, "pin" | "auto"] in order
const shown = page => page.$$eval("#quick-body .chips > *", els => els.map(el => {
  const c = el.matches(".chip") ? el : el.querySelector(".chip");
  const id = (el.querySelector("[data-food]") || el).getAttribute("data-food");
  return [id, c.classList.contains("auto") ? "auto" : "pin"];
}));
const logCount = page => page.evaluate(() => JSON.parse(localStorage.getItem("caltrk7f3a.log.v1")).length);

const page = await open(buildFixture());

// 1. First run: the 8 foods the old automatic list showed become the user's own, nothing auto-filled
let q = await quick(page), s = await shown(page);
console.log("seeded:", q.pins.join(", "));
if (q.pins.length !== 8 || q.hidden.length || s.length !== 8 || s.some(x => x[1] !== "pin")) fail("first-run seeding: " + JSON.stringify(s));
if (JSON.stringify(s.map(x => x[0])) !== JSON.stringify(q.pins)) fail("shown order is not the saved order");
if (await page.locator("#quick-body .chip.combo").count()) fail("combo chip still shown");

// 2. Edit mode: chips don't log; remove the first pinned food → an auto-filled one appears, faint, never the removed one
const before = await logCount(page);
await page.locator('[data-act="quick-edit"]').click();
await page.locator("#quick-body .qe .chip").first().click();
if (await logCount(page) !== before) fail("a chip logged food in edit mode");
const gone = q.pins[0];
await page.locator(`[data-act="quick-drop"][data-food="${gone}"]`).click();
q = await quick(page); s = await shown(page);
if (q.pins.includes(gone) || !q.hidden.includes(gone) || s.some(x => x[0] === gone)) fail("removed food still there");
const autos = s.filter(x => x[1] === "auto");
if (s.length !== 8 || autos.length !== 1) fail("expected 7 pinned + 1 auto: " + JSON.stringify(s));

// 3. "不要" on the auto one hides it and the next candidate fills in; "加入" pins it at the front
const a1 = autos[0][0];
await page.locator(`[data-act="quick-drop"][data-food="${a1}"]`).click();
s = await shown(page);
const a2 = s.find(x => x[1] === "auto");
if (!a2 || a2[0] === a1 || a2[0] === gone) fail("hidden auto came back or nothing filled: " + JSON.stringify(s));
await page.locator(`[data-act="quick-pin"][data-food="${a2[0]}"]`).click();
q = await quick(page);
if (q.pins[0] !== a2[0]) fail("pinned auto food is not first");
await page.locator('[data-act="quick-edit"]').click();   // 完成
if (await page.locator("#quick-body .qe").count()) fail("still in edit mode");
await page.locator(`.chip[data-act="quick-log"][data-food="${a2[0]}"]`).click();
if (await logCount(page) !== before + 1) fail("tap to log broken after editing");
await page.locator('.toast [data-toast="undo"]').click();

// 4. Search → "＋ 快速记录" on a generic food puts it first; the removed food can be added back the same way
await page.locator("#in-search").fill("豆腐");
const tofu = await page.locator('.r-sec ~ .r-row [data-act="quick-toggle"]').first().getAttribute("data-food");
await page.locator(`[data-act="quick-toggle"][data-food="${tofu}"]`).first().click();
if (!/✓/.test(await page.locator(`[data-act="quick-toggle"][data-food="${tofu}"]`).first().textContent())) fail("search toggle did not flip");
await page.locator("#btn-clear").click();
s = await shown(page);
if (s[0][0] !== tofu || s[0][1] !== "pin") fail("generic food not first: " + JSON.stringify(s));
const goneName = await page.evaluate(id => {
  const lib = JSON.parse(localStorage.getItem("caltrk7f3a.userfoods.v1")).find(f => f.id === id);
  return lib ? lib.name : null;
}, gone);
console.log("removed:", gone, goneName || "(library food)");

// 5. Food library page: every row has the toggle; removing there also hides it from auto-fill
await page.locator('.tabs [data-tab="library"]').click();
const libBtn = page.locator(`#lib-body [data-act="quick-toggle"][data-food="${a2[0]}"]`).first();
if (!/✓/.test(await libBtn.textContent())) fail("library toggle does not show pinned state");
await libBtn.click();
q = await quick(page);
if (q.pins.includes(a2[0]) || !q.hidden.includes(a2[0])) fail("library toggle did not remove");
await page.locator(`#lib-body [data-act="quick-toggle"][data-food="${gone}"]`).first().click();
q = await quick(page);
if (q.pins[0] !== gone || q.hidden.includes(gone)) fail("re-adding from the library did not restore the removed food");

// 6. Portion sheet: the big toggle flips and the quick block follows
await page.locator('.tabs [data-tab="today"]').click();
await page.locator(`.chip[data-act="quick-log"][data-food="${gone}"]`).click();
await page.locator('.toast [data-toast="edit"]').click();
const big = page.locator('.sheet [data-act="quick-toggle"]');
if (!/已在快速记录/.test(await big.textContent())) fail("sheet toggle wrong state");
await big.click();
if (!/加入快速记录/.test(await big.textContent())) fail("sheet toggle did not flip");
if ((await shown(page)).some(x => x[0] === gone)) fail("quick block not refreshed after sheet toggle");
await page.mouse.click(200, 20);

// 7. Survives a reload
const saved = await quick(page);
await page.reload();
await page.waitForTimeout(400);
if (JSON.stringify(await quick(page)) !== JSON.stringify(saved)) fail("state changed on reload");
console.log("after edits:", JSON.stringify(saved));

// 8. A pinned food later merged into a library food (UF_SAME_AS) shows as the library food; 5 pins are topped up to 8
{
  const fx = buildFixture();
  const st = JSON.parse(fx[SETTINGS]);
  st.quick = { pins: ["uf-mtwo4ipo"], hidden: [] };
  fx[SETTINGS] = JSON.stringify(st);
  const p2 = await open(fx);
  s = await shown(p2);
  if (s[0][0] !== "tesco-multiseed-bread" || s[0][1] !== "pin" || s.length !== 8) fail("merged pin: " + JSON.stringify(s));
  const ids = await p2.evaluate(() => [...new Set([...document.querySelectorAll("[data-food]")].map(e => e.getAttribute("data-food")))]);
  await p2.evaluate(([k, pins]) => { const st = JSON.parse(localStorage.getItem(k)); st.quick = { pins, hidden: [] }; localStorage.setItem(k, JSON.stringify(st)); }, [SETTINGS, ids.slice(0, 5)]);
  await p2.reload(); await p2.waitForTimeout(400);
  s = await shown(p2);
  if (s.filter(x => x[1] === "pin").length !== 5 || s.length !== 8) fail("5 pins should be topped up to 8: " + JSON.stringify(s));
  console.log("merged pin and top-up: ok");
}

// 9. New phone: importing a backup replaces the auto-seeded list, but never one the user already edited here
{
  const mine = { pins: ["oats-dry", "rice-cooked"], hidden: ["chicken-breast"] };
  const bk = { schema: "caltrk-export.v1", exported_at: "2026-10-20T10:00", app_version: "2.4.0",
    log: [{ id: "imp-q1", ts: "2026-09-01T08:00", food_id: "oats-dry", name: "燕麦片（干）", portion: "40 g", grams: 40, kcal: 150, confidence: "high", pending: false }],
    weight: [], days: [], training: [], user_foods: [], settings: { quick: mine } };
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "caltrk-q-")), "bk.json");
  fs.writeFileSync(file, JSON.stringify(bk));
  async function importInto(p) {
    await p.locator('.tabs [data-tab="export"]').click();
    const fc = p.waitForEvent("filechooser");
    await p.locator('[data-act="do-import"]').click();
    await (await fc).setFiles([file]);
    await p.waitForTimeout(400);
    return quick(p);
  }
  const fresh = await open(buildFixture());
  if (!(await quick(fresh)).seeded) fail("seeded flag missing");
  const got = await importInto(fresh);
  if (JSON.stringify(got) !== JSON.stringify(mine)) fail("import did not restore the backup's quick list: " + JSON.stringify(got));
  const edited = await open(buildFixture());
  await edited.locator('[data-act="quick-edit"]').click();
  await edited.locator('[data-act="quick-drop"]').first().click();
  const local = await quick(edited);
  if (local.seeded) fail("seeded flag kept after an edit");
  const kept = await importInto(edited);
  if (JSON.stringify(kept) !== JSON.stringify(local)) fail("import overwrote a list edited on this phone");
  console.log("backup import: restores onto a fresh phone, keeps local edits");
}

if (errors.length) fail("page errors: " + errors.join(" | "));
await browser.close();

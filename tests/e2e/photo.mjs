// Photo picking (v2.5.1). The iOS "Unable to Load Photos" error happens inside the system picker and never reaches
// the page; all the page sees is the picker closing empty ("cancel", or a change with no files). Checks that this
// shows a gentle hint that leads to the help sheet, that empty / unreadable files are skipped with a clear message,
// and that the barcode photo input does the same. Usage: node tests/e2e/photo.mjs <url>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { MOCK, NOW, buildFixture, claudeReply } from "./fixture.mjs";

const url = process.argv[2];
const ICON = { name: "IMG_0003.PNG", mimeType: "image/png",
  buffer: fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../apple-touch-icon.png")) };
const EMPTY = { name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.alloc(0) };
const JUNK = { name: "IMG_0002.JPG", mimeType: "image/jpeg", buffer: Buffer.from("not really a jpeg") };
const fail = m => { console.log("FAIL:", m); process.exitCode = 1; };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [], dialogs = [], requests = [];
page.on("pageerror", e => errors.push(e.message));
page.on("dialog", d => { dialogs.push(d.message()); d.accept(); });
await page.clock.setFixedTime(new Date(NOW));
await page.route("https://api.anthropic.com/**", async route => {
  requests.push(route.request().postDataJSON());
  await route.fulfill({ json: claudeReply(MOCK.meal) });
});
await page.route("https://world.openfoodfacts.org/**", r => r.fulfill({ status: 404, json: { status: 0 } }));
await page.goto(url + "apple-touch-icon.png");
await page.evaluate(fx => { localStorage.clear(); for (const k in fx) localStorage.setItem(k, fx[k]); }, buildFixture());
await page.goto(url);

const toast = () => page.locator(".toast.info .msg").textContent().catch(() => "");
async function pick(act, files) {
  const fc = page.waitForEvent("filechooser");
  await page.locator(`[data-act="${act}"]`).click();
  await (await fc).setFiles(files);
  await page.waitForTimeout(600);
}

// 1. Picker closes empty ("cancel" — what the page gets when iOS can't load the library) → hint → help sheet
await page.evaluate(() => document.getElementById("ai-photo-in").dispatchEvent(new Event("cancel")));
if (await toast() !== "没选到照片") fail("no hint on cancel");
await page.locator('.toast [data-toast="act"]').click();
const help = await page.locator("#sheet").textContent();
if (!/Unable to Load Photos/.test(help) || !/「拍照」/.test(help) || !/下载并保留原片/.test(help)) fail("help sheet text: " + help.slice(0, 120));
await page.locator('[data-act="close-sheet"]').click();
await page.waitForTimeout(400);
if (await page.locator("#backdrop.on").count()) fail("help sheet did not close");
// a change event with no files behaves the same
await page.evaluate(() => document.getElementById("ai-photo-in").dispatchEvent(new Event("change")));
if (await toast() !== "没选到照片") fail("no hint on empty change");

// 2. Every picked photo unreadable (0-byte iCloud placeholder, junk) → one clear message + help, no API call
dialogs.length = 0; requests.length = 0;
await pick("ai-meal-photo", [EMPTY, JUNK]);
if (!dialogs.some(d => /一张都没读出来/.test(d)) || requests.length) fail("all-unreadable: " + dialogs.join(" | ") + " requests=" + requests.length);
if (!/Unable to Load Photos/.test(await page.locator("#sheet").textContent())) fail("help sheet not opened after all-unreadable");
await page.locator('[data-act="close-sheet"]').click();
await page.waitForTimeout(400);

// 3. Some readable → carry on with those, say how many were skipped
dialogs.length = 0; requests.length = 0;
await pick("ai-meal-photo", [ICON, EMPTY]);
await page.waitForSelector('[data-act="meal-confirm"]', { timeout: 15000 }).catch(() => fail("partial: no meal sheet; dialogs " + dialogs.join(" | ")));
const imgs = requests[0] ? requests[0].messages[0].content.filter(b => b.type === "image").length : 0;
if (imgs !== 1) fail("partial: expected 1 image sent, got " + imgs);
if (!/2 张里有 1 张没读出来/.test(await toast())) fail("partial: no skipped-photo note");
console.log("label/meal photo: cancel hint, help sheet, all-unreadable and partial cases ok");
await page.mouse.click(200, 20); await page.waitForTimeout(350);

// 4. Barcode photo input: cancel → hint; empty file → fail sheet that mentions iCloud
await page.evaluate(() => document.getElementById("scan-photo-in").dispatchEvent(new Event("cancel")));
if (await toast() !== "没选到照片") fail("no hint on scan cancel");
await pick("scan-photo", [EMPTY]);
if (!/iCloud/.test(await page.locator("#sheet").textContent())) fail("scan empty file message");
console.log("barcode photo: cancel hint and empty file ok");

if (errors.length) fail("page errors: " + errors.join(" | "));
await browser.close();

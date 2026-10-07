// Voice logging end to end with Chromium's fake microphone: record → 16 kHz WAV → input_audio request → review sheet.
// Also checks that a model which rejects audio gets a clear message and no silent fallback. Usage: node tests/e2e/voice.mjs <url>
import { chromium } from "playwright";
import { MOCK, NOW, buildFixture } from "./fixture.mjs";

const url = process.argv[2];
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ permissions: ["microphone"] });
const page = await ctx.newPage();
const errors = [], dialogs = [], requests = [];
page.on("pageerror", e => errors.push(e.message));
page.on("dialog", d => { dialogs.push(d.message()); d.accept(); });
await page.clock.setFixedTime(new Date(NOW));
let reject = false;
await page.route("https://api.chatanywhere.org/**", async route => {
  const body = route.request().postDataJSON();
  requests.push(body);
  if (reject) return route.fulfill({ status: 400, json: { error: "audio not supported" } });
  await route.fulfill({ json: { choices: [{ message: { content: MOCK.voice } }] } });
});
await page.goto(url + "apple-touch-icon.png");
await page.evaluate(fx => { for (const k in fx) localStorage.setItem(k, fx[k]); }, buildFixture());
await page.goto(url);

const fail = m => { console.log("FAIL:", m); process.exitCode = 1; };
await page.locator('[data-act="ai-voice"]').click();
await page.waitForSelector('[data-act="voice-stop"]');
await page.waitForTimeout(1600);
await page.locator('[data-act="voice-stop"]').click();
await page.waitForSelector('[data-act="meal-confirm"]', { timeout: 15000 }).catch(e => { console.log("dialogs:", dialogs, "errors:", errors, "requests:", requests.length); throw e; });
const part = requests[0].messages[1].content[0];
const wav = Buffer.from(part.input_audio.data, "base64");
const rate = wav.readUInt32LE(24), secs = wav.readUInt32LE(40) / 2 / rate;
console.log(`request: model=${requests[0].model} part=${part.type}/${part.input_audio.format} ${wav.length} bytes, ${rate} Hz, ${secs.toFixed(2)} s`);
if (part.type !== "input_audio" || wav.toString("ascii", 0, 4) !== "RIFF" || rate !== 16000 || !(secs > 1 && secs < 3)) fail("bad audio payload");
const note = await page.locator(".sheet-b .note").first().textContent();
if (!note.includes("一碗牛肉面加一个卤蛋")) fail("transcript not shown: " + note);
await page.locator('[data-act="meal-portion"][data-g="350"]').click();
if (await page.locator('[data-mg="0"]').inputValue() !== "350") fail("portion chip did not set grams");
await page.locator('[data-act="meal-confirm"]').click();
const logged = await page.evaluate(() => JSON.parse(localStorage.getItem("caltrk7f3a.log.v1")).filter(e => e.ai && e.ts.startsWith("2026-10-06")).map(e => e.name + ":" + e.grams));
const uf = await page.evaluate(() => JSON.parse(localStorage.getItem("caltrk7f3a.userfoods.v1")).filter(f => f.name === "牛肉面")[0]);
console.log("logged:", logged.join(", "), "| saved portions:", uf && uf.portions.map(p => p.label + p.grams).join(" "), "default:", uf && uf.default_portion);
if (!logged.includes("牛肉面:350") || !uf || uf.default_portion !== "小碗") fail("entry or saved food wrong");

reject = true; requests.length = 0;
await page.locator('[data-act="ai-voice"]').click();
await page.waitForSelector('[data-act="voice-stop"]');
await page.waitForTimeout(1200);
await page.locator('[data-act="voice-stop"]').click();
await page.waitForTimeout(2500);
if (requests.length !== 1) fail("expected exactly one request (no fallback model), got " + requests.length);
if (!dialogs.some(d => /HTTP 400/.test(d) && /gemini/.test(d))) fail("no helpful error: " + dialogs.join(" | "));
console.log("rejected-audio path: 1 request, message shown");
if (errors.length) fail("page errors: " + errors.join(" | "));
await browser.close();

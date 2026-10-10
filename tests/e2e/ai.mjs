// AI flows end to end against a mocked Claude API (POST https://api.anthropic.com/v1/messages):
// what each request carries (model, schema, effort, headers), voice through a fake Web Speech API,
// label photo → web search (with a pause_turn resume) → Opus review, error and refusal messages,
// and the one-time migration away from a ChatAnywhere key. Usage: node tests/e2e/ai.mjs <url>
import path from "node:path";
import { chromium } from "playwright";
import { MOCK, NOW, buildFixture, claudeReply } from "./fixture.mjs";

const url = process.argv[2];
const ICON = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../apple-touch-icon.png");
const AI_KEY = "caltrk7f3a.ai.v1";
const fail = m => { console.log("FAIL:", m); process.exitCode = 1; };

// Fake SpeechRecognition: interim result, then a final, and the last final arrives on stop() like real browsers.
// window.__sr.mode: "ok" | "denied" (not-allowed error, no text).
const FAKE_SR = `
(() => {
  window.__sr = { mode: "ok", text: ["一碗牛肉面", "加一个卤蛋"] };
  const mk = (t, fin) => Object.assign([{ transcript: t }], { isFinal: fin });
  class FakeSR {
    start() {
      const cfg = window.__sr; this.cfg = cfg; window.__srLast = this;
      setTimeout(() => {
        this.onstart && this.onstart();
        if (cfg.mode === "denied") { this.onerror && this.onerror({ error: "not-allowed" }); this.onend && this.onend(); return; }
        setTimeout(() => this.onresult({ results: [mk(cfg.text[0], false)] }), 40);
        setTimeout(() => this.onresult({ results: [mk(cfg.text[0], true), mk(cfg.text[1], false)] }), 100);
      }, 20);
    }
    stop() { setTimeout(() => { this.onresult({ results: [mk(this.cfg.text[0], true), mk(this.cfg.text[1], true)] }); this.onend && this.onend(); }, 20); }
    abort() { setTimeout(() => this.onend && this.onend(), 10); }
  }
  window.SpeechRecognition = FakeSR;
})();`;

const browser = await chromium.launch();
const errors = [], dialogs = [], requests = [];
let reply = null;   // (request) => { status, json } ; null = answer by system prompt

async function open(fx) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => { dialogs.push(d.message()); d.accept(); });
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(FAKE_SR);
  await page.route("https://api.anthropic.com/**", async route => {
    const req = { headers: route.request().headers(), body: route.request().postDataJSON(), url: route.request().url() };
    requests.push(req);
    const r = reply && reply(req);
    if (r) return route.fulfill({ status: r.status || 200, json: r.json });
    const sys = req.body.system;
    await route.fulfill({ json: claudeReply(/营养数据查找员/.test(sys) ? MOCK.web : /营养标签识别器/.test(sys) ? MOCK.label : MOCK.voice) });
  });
  await page.route("https://world.openfoodfacts.org/**", route => route.fulfill({ status: 404, json: { status: 0 } }));
  await page.goto(url + "apple-touch-icon.png");
  await page.evaluate(fx => { localStorage.clear(); for (const k in fx) localStorage.setItem(k, fx[k]); }, fx);
  await page.goto(url);
  return { ctx, page };
}
const aiCfg = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), AI_KEY);
const userFood = (page, name) => page.evaluate(n => JSON.parse(localStorage.getItem("caltrk7f3a.userfoods.v1")).filter(f => f.name === n)[0], name);

// ── 1. Migration: a ChatAnywhere key is dropped and the user is told to paste an Anthropic key ──
{
  const fx = buildFixture();
  fx[AI_KEY] = JSON.stringify({ key: "sk-chatanywhere-abcdef123", model: "gemini-3.8-flash", model2: "gpt-6-luna", m26: 1, m41: 1 });
  const { ctx, page } = await open(fx);
  const cfg = await aiCfg(page);
  console.log("migrated config:", JSON.stringify(cfg));
  if (cfg.key || cfg.model || cfg.model2 || cfg.m26 || cfg.oldKey !== 1 || cfg.claude !== 1) fail("old ChatAnywhere config not migrated");
  if (!/ChatAnywhere 密钥用不了/.test(await page.locator("#ai-mod").textContent())) fail("today page does not explain the old key");
  await page.locator('[data-act="ai-meal-photo"]').click();
  if (!/从 ChatAnywhere 换成 Claude/.test(await page.locator("#view-export").textContent())) fail("export page does not explain the switch");
  await page.locator("#ai-key-in").fill("sk-chatanywhere-again99");   // not sk-ant- → confirm, accepted by the handler
  await page.locator('[data-act="save-ai-key"]').click();
  if (!dialogs.some(d => /不像 Anthropic 的 API 密钥/.test(d))) fail("no warning for a non-Anthropic key");
  await page.locator("#ai-key-in").fill("sk-ant-api03-new-key-123");
  await page.locator('[data-act="save-ai-key"]').click();
  const cfg2 = await aiCfg(page);
  if (cfg2.key !== "sk-ant-api03-new-key-123" || cfg2.oldKey) fail("new key not saved or old-key flag kept: " + JSON.stringify(cfg2));
  if (!/已启用 · Claude Sonnet 5\.5/.test(await page.locator("#view-export").textContent())) fail("status row not updated");
  await ctx.close();
  console.log("migration: old key cleared, explained, new key saved");
}

const { page } = await open(buildFixture());

// ── 2. Voice: live transcript, then a low-effort structured text request, review sheet shows what was heard ──
dialogs.length = 0; requests.length = 0;
await page.locator('[data-act="ai-voice"]').click();
await page.waitForSelector('[data-act="voice-stop"]');
await page.waitForTimeout(250);
const live = await page.locator("#voice-heard").textContent();
if (live !== "一碗牛肉面加一个卤蛋") fail("live transcript wrong: " + live);
await page.locator('[data-act="voice-stop"]').click();
await page.waitForSelector('[data-act="meal-confirm"]', { timeout: 15000 }).catch(e => { console.log("dialogs:", dialogs, "errors:", errors); throw e; });
{
  const { headers, body, url: u } = requests[0];
  const txt = body.messages[0].content[0].text;
  console.log(`voice request: ${u} model=${body.model} effort=${body.output_config.effort} format=${body.output_config.format && body.output_config.format.type} beta=${headers["anthropic-beta"]}`);
  if (new URL(u).pathname !== "/v1/messages" || body.model !== "claude-sonnet-5-5") fail("wrong endpoint or model");
  if (headers["x-api-key"] !== "sk-ant-test-1234567890" || headers["anthropic-dangerous-direct-browser-access"] !== "true") fail("auth / browser headers missing");
  if (!/server-side-fallback-2026-07-01/.test(headers["anthropic-beta"] || "") || body.fallbacks !== "default" || "betas" in body) fail("fallback opt-in wrong");
  if (body.output_config.effort !== "low" || body.output_config.format.type !== "json_schema" || !body.output_config.format.schema.properties.items) fail("text request config wrong");
  if (!/饮食热量估算器/.test(body.system) || !txt.includes("一碗牛肉面加一个卤蛋") || !/语音转写/.test(txt)) fail("transcript not sent: " + txt);
  if ("temperature" in body || "thinking" in body) fail("sends sampling/thinking params the model rejects");
}
const heardNote = await page.locator(".sheet-b .note").first().textContent();
if (!heardNote.includes("一碗牛肉面加一个卤蛋")) fail("heard text not shown: " + heardNote);
await page.locator('[data-act="meal-portion"][data-g="350"]').click();
await page.locator('[data-act="meal-confirm"]').click();
const logged = await page.evaluate(() => JSON.parse(localStorage.getItem("caltrk7f3a.log.v1")).filter(e => e.ai && e.ts.startsWith("2026-10-06")).map(e => e.name + ":" + e.grams));
const noodles = await userFood(page, "牛肉面");
console.log("logged:", logged.join(", "), "| saved default portion:", noodles && noodles.default_portion);
if (!logged.includes("牛肉面:350") || !noodles || noodles.default_portion !== "小碗") fail("voice entry or saved food wrong");

// ── 3. Voice failures: permission denied and no recognizer at all → clear message, no API call ──
dialogs.length = 0; requests.length = 0;
await page.evaluate(() => { window.__sr.mode = "denied"; });
await page.locator('[data-act="ai-voice"]').click();
await page.waitForTimeout(300);
if (!dialogs.some(d => /权限/.test(d) && /听写/.test(d)) || requests.length) fail("denied mic: " + dialogs.join(" | "));
await page.evaluate(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
await page.locator('[data-act="ai-voice"]').click();
await page.waitForTimeout(100);
if (!dialogs.some(d => /不支持网页里的语音识别/.test(d)) || requests.length) fail("no recognizer: " + dialogs.join(" | "));
if (await page.locator('[data-act="voice-stop"]').count()) fail("still in recording state");
console.log("voice failures: messages shown, no requests");

// ── 4. Label photo with Opus review: Sonnet reads it (image block, medium effort) → fat unread → web search,
//       which pauses once (pause_turn) and is resumed → Opus re-reads the same photos ──
dialogs.length = 0; requests.length = 0;
await page.evaluate(k => { const c = JSON.parse(localStorage.getItem(k)); c.model2 = "claude-opus-5-5"; localStorage.setItem(k, JSON.stringify(c)); }, AI_KEY);
await page.reload();
let paused = false;
reply = req => {
  if (!/营养数据查找员/.test(req.body.system) || paused) return null;
  paused = true;
  return { json: claudeReply("", { stop_reason: "pause_turn",
    content: [{ type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "Tesco Greek Style Yogurt 500g nutrition" } }] }) };
};
const fc = page.waitForEvent("filechooser");
await page.locator('[data-act="ai-label-photo"]').click();
await (await fc).setFiles([ICON, ICON]);
await page.waitForSelector('[data-act="pick-portion"]', { timeout: 15000 }).catch(e => { console.log("dialogs:", dialogs, "errors:", errors); throw e; });
reply = null;
{
  const [read, web1, web2, review] = requests.map(r => r.body);
  console.log("label requests:", requests.map(r => r.body.model + (r.body.tools ? "+" + r.body.tools[0].type : "") + "/" + r.body.output_config.effort + "/" + r.body.messages.length).join(", "));
  if (requests.length !== 4) fail("expected read, web, web-resume, review; got " + requests.length);
  const img = read.messages[0].content[0];
  if (read.model !== "claude-sonnet-5-5" || read.output_config.effort !== "medium" || !read.output_config.format.schema.properties.read) fail("label read config wrong");
  if (img.type !== "image" || img.source.type !== "base64" || img.source.media_type !== "image/jpeg" || read.messages[0].content.length !== 3) fail("images not sent as base64 blocks");
  if (!web1.tools || web1.tools[0].type !== "web_search_20260209" || web1.output_config.format) fail("web search request wrong (must not combine with structured output)");
  if (web2.messages.length !== 2 || web2.messages[1].role !== "assistant" || web2.messages[1].content[0].type !== "server_tool_use") fail("pause_turn not resumed with the paused turn");
  if (review.model !== "claude-opus-5-5" || review.output_config.effort !== "medium" || JSON.stringify(review.messages) !== JSON.stringify(read.messages)) fail("review request wrong");
  const food = await userFood(page, "Tesco 希腊酸奶");
  console.log("saved label note:", food && food.note);
  // The label read contradicts itself (120 kcal vs ~56 from macros), so all four numbers come from the web copy;
  // Opus (mocked with the same bad read) then disagrees with the corrected numbers and that is flagged.
  if (!food || food.per_100g.fat !== 9.6 || !/网上补：.*脂肪/.test(food.note) || !/复核模型读数不同/.test(food.note)) fail("web fill or review result missing");
}
await page.locator('[data-act="pick-portion"]').first().click();

// ── 5. Errors and refusals reach the user as one readable line ──
async function textEstimate(r) {
  dialogs.length = 0; requests.length = 0; reply = () => r;
  await page.locator("#ai-meal-text").fill("番茄炒蛋盖饭");
  await page.locator('[data-act="ai-meal-text"]').click();
  await page.waitForFunction(() => !document.querySelector("#ai-mod button[disabled]"));
  await page.waitForTimeout(100);
  reply = null;
  return dialogs.join(" | ");
}
let d = await textEstimate({ status: 401, json: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } });
if (!/HTTP 401（密钥无效/.test(d) || requests.length !== 1) fail("401: " + d + " requests=" + requests.length);
d = await textEstimate({ json: claudeReply("", { content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "general_harms", explanation: null } }) });
if (!/Claude 拒绝了这次请求（general_harms）/.test(d)) fail("refusal: " + d);
d = await textEstimate({ status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } } });
if (!/HTTP 400：Your credit balance is too low/.test(d)) fail("400: " + d);
console.log("errors: 401, refusal, 400 explained");

if (errors.length) fail("page errors: " + errors.join(" | "));
await browser.close();

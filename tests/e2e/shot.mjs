// Screenshot helper for eyeballing layout: node tests/e2e/shot.mjs <dir> <tab> <out.png> [light|dark] [range]
import { chromium } from "playwright";
import { NOW, buildFixture } from "./fixture.mjs";
import { serve } from "./serve.mjs";

const [dir, tab, out, scheme = "light", range] = process.argv.slice(2);
const srv = await serve(dir, 8193);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
await page.clock.setFixedTime(new Date(NOW));
await page.goto(srv.url + "apple-touch-icon.png");
await page.evaluate(fx => { localStorage.clear(); for (const k in fx) localStorage.setItem(k, fx[k]); }, buildFixture());
await page.goto(srv.url);
if (tab) await page.locator(`.tabs [data-tab="${tab}"]`).click();
if (range) await page.locator(`[data-act="trend-range"][data-r="${range}"]`).click();
await page.waitForTimeout(300);
const mod = page.locator("#trend-mod");
await ((await mod.count()) ? mod : page.locator(".page")).screenshot({ path: out });
await browser.close(); srv.close();

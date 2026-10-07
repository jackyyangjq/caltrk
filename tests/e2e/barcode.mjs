// Checks that the barcode library loads from its relative path and decodes a generated EAN-13 photo.
// Usage: node tests/e2e/barcode.mjs <url>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { MOCK, NOW } from "./fixture.mjs";

const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const PAR = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
function ean13Bits(code) {
  const d = code.split("").map(Number);
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (PAR[d[0]][i - 1] === "L" ? L : G)[d[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + "101";
}
const code = "5057753936686";
const bits = ean13Bits(code), W = 4;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(bits.length + 20) * W}" height="260" style="background:#fff">` +
  [...bits].map((b, i) => b === "1" ? `<rect x="${(i + 10) * W}" y="20" width="${W}" height="220" fill="#000"/>` : "").join("") + "</svg>";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(svg);
const png = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bc-")), "bc.png");
await page.locator("svg").screenshot({ path: png });
await page.clock.setFixedTime(new Date(NOW));
await page.route("https://world.openfoodfacts.org/**", r => r.fulfill({ json: MOCK.off }));
await page.goto(process.argv[2]);
const fc = page.waitForEvent("filechooser");
await page.locator('[data-act="scan-photo"]').click();
await (await fc).setFiles([png]);
await page.waitForSelector('[data-act="scan-save"]', { timeout: 20000 });
const meta = await page.locator(".sheet-h .meta").textContent();
console.log("decoded:", meta);
await browser.close();
process.exit(meta.includes(code) ? 0 : 1);

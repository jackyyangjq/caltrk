// End-to-end smoke test: walk every flow of the built app (default: dist/) and fail on any page error.
// To diff two versions step by step instead, see compare.mjs.
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { runScenario } from "./scenario.mjs";
import { serve } from "./serve.mjs";

const dir = process.argv[2] || "dist";
const srv = await serve(dir, 8190);
const browser = await chromium.launch();
const snaps = await runScenario(browser, srv.url);
await browser.close();
const errors = snaps[snaps.length - 1].errors;
console.log(`${snaps.length - 1} steps run on ${dir}/; page errors: ${errors.length ? errors.join(" | ") : "none"}`);
let ok = !errors.length;
for (const t of ["./barcode.mjs", "./ai.mjs"]) {
  const c = spawn("node", [new URL(t, import.meta.url).pathname, srv.url], { stdio: "inherit" });
  if (await new Promise(done => c.on("exit", done)) !== 0) ok = false;
}
srv.close();
process.exit(ok ? 0 : 1);

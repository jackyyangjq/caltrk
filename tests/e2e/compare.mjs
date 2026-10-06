// Differential test: run the same scenario against two builds and report every step where they differ.
// Usage: node tests/e2e/compare.mjs <baseline-dir> <candidate-dir>
//   e.g. git worktree add /tmp/base v1.17.0 && npm run build && node tests/e2e/compare.mjs /tmp/base dist
import { chromium } from "playwright";
import { runScenario } from "./scenario.mjs";
import { serve } from "./serve.mjs";

const [dirA, dirB] = process.argv.slice(2);
const sa = await serve(dirA, 8191), sb = await serve(dirB, 8192);
const A = sa.url, B = sb.url;
const browser = await chromium.launch();
const a = await runScenario(browser, A);
const b = await runScenario(browser, B);
await browser.close();
sa.close(); sb.close();

function firstDiff(x, y) {
  x = String(x ?? ""); y = String(y ?? "");
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  return "@" + i + "\n    A: …" + x.slice(Math.max(0, i - 80), i + 120) + "\n    B: …" + y.slice(Math.max(0, i - 80), i + 120);
}
let diffs = 0;
const n = Math.max(a.length, b.length);
for (let i = 0; i < n; i++) {
  const sa = a[i] || {}, sb = b[i] || {};
  if (sa.step !== sb.step) { console.log("STEP MISMATCH", i, sa.step, sb.step); diffs++; break; }
  for (const k of ["dom", "tabs", "sheet", "toast", "scan", "ls", "dialogs", "download", "errors"]) {
    const va = JSON.stringify(sa[k]), vb = JSON.stringify(sb[k]);
    if (va !== vb) { diffs++; console.log(`DIFF step=${sa.step} field=${k} ${firstDiff(va, vb)}`); }
  }
}
const errs = b[b.length - 1].errors;
console.log(`${n} steps compared, ${diffs} differences; candidate page errors: ${errs.length ? errs.join(" | ") : "none"}`);
process.exit(diffs || errs.length ? 1 : 0);

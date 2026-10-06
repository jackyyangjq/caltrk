import { dayLabel, nowTs, todayStr } from "./lib/util.js";
import { TITLES, activeTab } from "./main.js";
import { entriesOn } from "./store.js";
import { renderToday } from "./views/today.js";

/* ── 在看哪一天 ─────────────────────────────────────────────
   跨过午夜才想起昨天没点「记全」，得能翻回去改。viewDate 不是今天时：
   页面顶部常驻一条醒目提示，「今日」页的记录/训练/记全全部落在 viewDate 上；
   翻日、或离开超过 REVERT_MIN 分钟再回来，自动跳回今天，
   免得在旧日期上把今天的饭记进去。 */
export var viewDate = todayStr();
export var REVERT_MIN = 10;
export function viewingToday() { return viewDate === todayStr(); }
export function setViewDate(d) {
  viewDate = d;
  renderToday();
  syncTopbar();
  window.scrollTo(0, 0);
}

export function entriesOfView() { return entriesOn(viewDate); }

/* 补记到过去某天：时刻用当前钟点（0:10 补昨天的宵夜，正好落在「夜宵」那一栏） */
export function entryTs() { return viewingToday() ? nowTs() : viewDate + nowTs().slice(10); }
export function syncTopbar() {
  var past = activeTab() === "today" && !viewingToday();
  document.getElementById("tb-title").textContent = past ? dayLabel(viewDate) : TITLES[activeTab()];
  document.getElementById("tb-date").textContent = past ? "今天是 " + todayStr().slice(5) : todayStr();
}

export var flashId = null;
export function setFlash(v) { flashId = v; }
/* 只换日期、不重绘（启动、跨午夜、久离回来时用） */
export function setViewDateRaw(d) { viewDate = d; }

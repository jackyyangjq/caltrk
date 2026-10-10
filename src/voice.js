import { aiEstimateMealText } from "./ai.js";
import { transcriptOf } from "./lib/speech.js";
import { renderAiMod } from "./views/today.js";

/* ── 语音记录（v2.2；v2.3 改成浏览器语音识别）──────────────────
   点「🎤」开始说，点「说完了」停（最长 VOICE_MAX_S 秒自动停）。Claude API 不收音频，所以先用浏览器自带的
   语音识别（Web Speech API，iOS Safari / Chrome 都有，中文）转成文字——iPhone 能在本机识别时在本机，否则交给
   苹果的服务器；Chrome 交给谷歌——再走和文字估算一样的流程：确认面板里显示「听到的是」，确认后每样东西存进「我的食物」。
   浏览器不支持、或者被拒了权限，就提示改用键盘上的 🎤 听写到文字框。
   事件顺序：正常是 start → result… → end；出错时 Chrome 是 error → end，而 Safari 在开始之前出的错
   （权限被拒、关了听写、主屏幕模式不给用、麦克风打不开）只发 error、不发 end，所以 error 也要能收尾。 */
export var VOICE_MAX_S = 30;
export var voiceSt = null;   /* { rec, t0, tick, stopTimer, errTimer, final, interim, err, cancelled, done } */

function recognizerClass() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function clearTimers(st) { clearInterval(st.tick); clearTimeout(st.stopTimer); clearTimeout(st.errTimer); }

export function voiceStart() {
  if (voiceSt) return;
  var R = recognizerClass();
  if (!R) {
    alert("这个浏览器不支持网页里的语音识别。可以点文字框，用键盘上的 🎤 听写，说完再点「估算」。");
    return;
  }
  var rec = new R();
  rec.lang = "zh-CN";
  rec.continuous = true;        /* 中间停顿一下不算说完，等点「说完了」 */
  rec.interimResults = true;    /* 边说边显示 */
  var st = { rec: rec, t0: 0, final: "", interim: "", err: null, cancelled: false };
  voiceSt = st;
  rec.onstart = function () {
    if (voiceSt !== st) return;
    st.t0 = performance.now();   /* 单调时钟：改系统时间不影响计时 */
    st.tick = setInterval(voiceTick, 250);
    st.stopTimer = setTimeout(voiceStop, VOICE_MAX_S * 1000);
    renderAiMod();
  };
  rec.onresult = function (e) {
    var t = transcriptOf(e.results);
    st.final = t.final; st.interim = t.interim;
    var el = document.getElementById("voice-heard");
    if (el) el.textContent = (st.final + st.interim) || "…";
  };
  rec.onerror = function (e) {
    st.err = e && e.error;
    /* 还没开始就出错（Safari 不会再发 end）：直接收尾；开始以后出错一般会跟着 end，等它一会儿，不来也收尾 */
    if (!st.t0) voiceFinish(st);
    else { clearTimeout(st.errTimer); st.errTimer = setTimeout(function () { voiceFinish(st); }, 1500); }
  };
  rec.onend = function () { voiceFinish(st); };
  renderAiMod();
  try { rec.start(); } catch (e) {
    voiceSt = null;
    renderAiMod();
    alert("打不开语音识别：" + (e && e.message ? e.message : e) + "\n可以用键盘上的 🎤 听写到文字框。");
  }
}
function voiceTick() {
  var el = document.getElementById("voice-t");
  if (el && voiceSt && voiceSt.t0) el.textContent = Math.floor((performance.now() - voiceSt.t0) / 1000) + " 秒 / " + VOICE_MAX_S;
}
export function voiceStop() {
  var st = voiceSt;
  if (!st) return;
  clearTimers(st);
  try { st.rec.stop(); } catch (e) {}   /* → 最后的结果 → onend → voiceFinish */
}
export function voiceCancel() {
  var st = voiceSt;
  if (!st) return;
  st.cancelled = true;
  clearTimers(st);
  voiceSt = null;
  try { st.rec.abort(); } catch (e) {}
  renderAiMod();
}
var VOICE_ERR = {
  "not-allowed": "没有拿到麦克风或语音识别的权限。在弹窗里点允许；被拒过的话去 iPhone 设置 → Safari → 麦克风 改成「询问」。",
  "service-not-allowed": "这个浏览器现在不让网页用语音识别（从主屏幕打开时 iPhone 可能不给用；也要在 iPhone 设置里打开 Siri 与听写）。",
  "audio-capture": "打不开麦克风。",
  "network": "语音识别要联网，网络好像断了。",
  "language-not-supported": "这个浏览器的语音识别不支持中文。"
};
function voiceFinish(st) {
  if (st.done) return;   /* error 和 end 都会走到这里，只处理一次 */
  st.done = true;
  clearTimers(st);
  if (voiceSt === st) voiceSt = null;
  if (st.cancelled) return;
  renderAiMod();
  /* 点「说完了」后还没定稿的那截也算上，不然最后半句会丢 */
  var text = (st.final + st.interim).trim();
  if (!text) {
    /* iPhone 上什么都没听到时报的是 aborted（不是 no-speech）；取消的情况上面已经返回了 */
    var quiet = !st.err || st.err === "no-speech" || st.err === "aborted";
    alert((VOICE_ERR[st.err] || (quiet ? "没听到说话，再试一次（说完再点「说完了」）。" : "语音识别出错（" + st.err + "）。")) +
      "\n也可以点文字框，用键盘上的 🎤 听写，再点「估算」。");
    return;
  }
  aiEstimateMealText(text, true);
}

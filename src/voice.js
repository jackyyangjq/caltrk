import { AI_SYS_MEAL, aiChat, openMealSheet } from "./ai.js";
import { aiParseMeal } from "./lib/parse.js";
import { bytesToBase64, encodeWav } from "./lib/wav.js";
import { renderAiMod } from "./views/today.js";

/* ── 语音记录（v2.2）────────────────────────────────────────
   点「🎤 说」开始录，点「说完了」停（最长 VOICE_MAX_S 秒自动停）。录音在本机转成 16 kHz WAV，
   作为 input_audio 发给识别模型，走和文字估算一样的确认面板，确认后每样东西存进「我的食物」。
   要模型和中转都收音频才行（Gemini 系列一般可以）；不收的话会提示改用键盘上的听写。 */
export var VOICE_MAX_S = 30;
var VOICE_RATE = 16000;
export var voiceSt = null;   /* { rec, stream, chunks, t0, tick, stopTimer, cancelled } */

function stopTracks(st) { if (st && st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); }); }

export function voiceStart() {
  if (voiceSt) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    alert("这个浏览器不能在网页里录音。可以点文字框，用键盘上的 🎤 听写，说完再点「估算」。");
    return;
  }
  var st = { chunks: [], t0: 0, cancelled: false };
  voiceSt = st;
  renderAiMod();
  navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
    if (voiceSt !== st) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    st.stream = stream;
    st.rec = new MediaRecorder(stream);
    st.rec.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
    st.rec.onstop = function () { voiceFinish(st); };
    st.rec.start();
    st.t0 = performance.now();   /* 单调时钟：改系统时间不影响录音时长 */
    st.tick = setInterval(voiceTick, 250);
    st.stopTimer = setTimeout(voiceStop, VOICE_MAX_S * 1000);
    renderAiMod();
  }).catch(function (e) {
    voiceSt = null;
    renderAiMod();
    var denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    alert(denied ? "没有拿到麦克风权限。在弹窗里点允许；被拒过的话去 iPhone 设置 → Safari → 麦克风 改成「询问」。也可以用键盘上的 🎤 听写到文字框。"
                 : "打不开麦克风：" + (e && e.message ? e.message : e));
  });
}
function voiceTick() {
  var el = document.getElementById("voice-t");
  if (el && voiceSt && voiceSt.t0) el.textContent = Math.floor((performance.now() - voiceSt.t0) / 1000) + " 秒 / " + VOICE_MAX_S;
}
function clearTimers(st) { clearInterval(st.tick); clearTimeout(st.stopTimer); }
export function voiceStop() {
  var st = voiceSt;
  if (!st || !st.rec || st.rec.state === "inactive") return;
  clearTimers(st);
  st.rec.stop();   /* onstop → voiceFinish */
}
export function voiceCancel() {
  var st = voiceSt;
  if (!st) return;
  st.cancelled = true;
  clearTimers(st);
  if (st.rec && st.rec.state !== "inactive") st.rec.stop();
  stopTracks(st);
  voiceSt = null;
  renderAiMod();
}
function voiceFinish(st) {
  stopTracks(st);
  if (voiceSt === st) voiceSt = null;
  if (st.cancelled) return;
  var secs = (performance.now() - st.t0) / 1000;
  if (secs < 0.8 || !st.chunks.length) { renderAiMod(); alert("没录到声音，再试一次（说完再点「说完了」）。"); return; }
  var blob = new Blob(st.chunks, { type: st.rec.mimeType || "audio/mp4" });
  blobToWav16k(blob).then(function (wav) {
    var content = [
      { type: "input_audio", input_audio: { data: bytesToBase64(wav), format: "wav" } },
      { type: "text", text: "这段语音说的是这一餐吃了什么（可能中英文夹杂）。按系统要求输出 JSON，heard 填你听到的原话。" }
    ];
    aiChat(AI_SYS_MEAL, content, function (txt) {
      var meal = aiParseMeal(txt);
      if (!meal) { alert("AI 没听明白，换个说法再试，或者用文字描述。"); return; }
      meal.src = "text";   /* 和文字估算一样：确认后每样都存进「我的食物」 */
      openMealSheet(meal);
    }, { noFallback: true,
         failHint: "如果是 HTTP 400/415 之类的错误，多半是这个模型或中转不收语音：到「导出」页把识别模型换成 gemini 系列再试，" +
                   "或者点文字框、用键盘上的 🎤 听写，再点「估算」。" });
  }).catch(function (e) {
    renderAiMod();
    alert("录音转换失败：" + (e && e.message ? e.message : e) + "\n可以用键盘上的 🎤 听写到文字框。");
  });
}

/* 解码 → 重采样到 16 kHz 单声道 → WAV */
function blobToWav16k(blob) {
  return blob.arrayBuffer().then(function (buf) {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    return new Promise(function (ok, fail) { ac.decodeAudioData(buf, ok, fail); }).then(function (audio) {
      if (ac.close) ac.close();
      var len = Math.max(1, Math.ceil(audio.duration * VOICE_RATE));
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var off = new OAC(1, len, VOICE_RATE);
      var src = off.createBufferSource();
      src.buffer = audio;
      src.connect(off.destination);
      src.start(0);
      return off.startRendering();
    }).then(function (rendered) {
      return encodeWav(rendered.getChannelData(0), VOICE_RATE);
    });
  });
}

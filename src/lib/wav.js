/* ── 语音记录用的 WAV 编码（v2.2）─────────────────────────────
   手机录下来是 m4a/webm，聊天接口的 input_audio 只认 wav/mp3，所以在本地解码后
   重采样成 16 kHz 单声道、16 位 PCM 的 WAV：30 秒约 1 MB，够模型听清中文。 */
export function encodeWav(samples, rate) {
  var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (var i = 0; i < n; i++) {
    var x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Uint8Array(buf);
}
export function bytesToBase64(bytes) {
  var s = "", CH = 0x8000;
  for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

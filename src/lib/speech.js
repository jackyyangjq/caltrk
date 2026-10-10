/* 把浏览器语音识别（Web Speech API）的结果拼成一句话。results 是到目前为止的全部片段；
   有的浏览器每个定稿片段只含新说的那截，有的可能把从头到现在的全文放进新的定稿片段（没在真机上确认过，防着），
   两种都要拼对、不能重复。没定稿的那截单独返回，「说完了」时也算上，不然最后半句会丢；
   全文式的浏览器里没定稿那截也可能从头带着已定稿的部分，去掉重复的开头。 */
export function transcriptOf(results) {
  var fin = "", interim = "";
  for (var i = 0; i < results.length; i++) {
    var r = results[i], t = r && r[0] ? String(r[0].transcript || "").trim() : "";
    if (!t) continue;
    if (!r.isFinal) { interim += t; continue; }
    if (fin && t.indexOf(fin) === 0) fin = t;              /* 全文式：新片段从头包含了旧的 */
    else if (fin.slice(-t.length) !== t) fin += t;         /* 增量式：接上；和结尾完全重复的一段跳过 */
  }
  if (fin && interim.indexOf(fin) === 0) interim = interim.slice(fin.length);
  return { final: fin, interim: interim };
}

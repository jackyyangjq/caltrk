/* ── ChatAnywhere（OpenAI 兼容中转）的纯函数部分（tests/unit/chatanywhere.test.js 覆盖）──
   v2.5（用户要求）：Claude 官方额度用完时还能用 ChatAnywhere。页面里的请求内容按 Claude 的格式拼
   （image / text 块），发给 ChatAnywhere 前在这里换成 chat-completions 的格式。发请求在 ai.js。 */
export var CA_BASE = "https://api.chatanywhere.org";
export var CA_DEFAULT_MODEL = "claude-sonnet-5-5";
export var CA_SEARCH_MODEL = "gpt-4o-mini-search-preview";   /* ChatAnywhere 最便宜的联网搜索模型（2026-10 价目页） */
/* 下拉候选（2026-10-06 查的价目页）。默认用户指定 claude-sonnet-5-5 */
export var CA_MODEL_OPTS = [
  ["claude-sonnet-5-5", "claude-sonnet-5.5（默认）"],
  ["gemini-3.8-flash", "gemini-3.8-flash（便宜，约 1/3 价）"],
  ["gpt-6-luna", "gpt-6-luna（最省）"],
  ["gpt-5.4-mini", "gpt-5.4-mini"],
  ["gpt-6.1-sol", "gpt-6.1-sol（高准确）"],
  ["gpt-4.1-mini", "gpt-4.1-mini（老默认，确认能读图）"]
];

/* Claude 格式的内容块 → chat-completions 的：图片变成 data URL 的 image_url，文字原样 */
export function toOpenAIContent(content) {
  if (typeof content === "string") return content;
  return content.map(function (b) {
    if (b.type === "image") return { type: "image_url", image_url: { url: "data:" + b.source.media_type + ";base64," + b.source.data } };
    return { type: "text", text: b.text };
  });
}
/* 只给确认接受 temperature 0 的老型号传 0；gpt-5/6、o 系列、Claude Sonnet 5 起只接受默认值，传了会报错 */
export function caBody(model, sys, content) {
  var body = { model: model, messages: [{ role: "system", content: sys }, { role: "user", content: toOpenAIContent(content) }] };
  if (/^(gpt-4|gemini-2|claude-haiku-4)/.test(model) && !/search/.test(model)) body.temperature = 0;
  return body;
}
export function caReplyText(j) {
  var txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!txt || !String(txt).trim()) throw new Error("空回复");
  return String(txt);
}
export function caHttpError(status, detail) {
  var why = status === 401 ? "（ChatAnywhere 密钥无效？去「导出」页重新粘贴）"
    : status === 429 ? "（请求太频繁或额度用完）"
    : status === 400 || status === 404 ? "（模型名不对，或这个模型不收图片？去「导出」页换个模型）" : "";
  var e = new Error("ChatAnywhere HTTP " + status + why + (detail ? "：" + String(detail).slice(0, 120) : ""));
  e.status = status;
  return e;
}

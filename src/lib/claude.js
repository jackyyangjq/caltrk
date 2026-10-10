import Anthropic from "@anthropic-ai/sdk";

/* ── Claude API 的纯函数部分（tests/unit/claude.test.js 覆盖）：结构化输出的 schema、
   照片转内容块、从回复里取文字、错误提示。发请求和界面在 ai.js。 */

/* 结构化输出（output_config.format）：接口保证回复就是这个结构的 JSON。
   接口要求每个对象都写 additionalProperties: false；数值范围它不管（不支持 minimum/maximum），
   照旧由 lib/parse.js 夹逼和丢弃。所有字段都必填，没有的值用 null。 */
function obj(props) {
  return { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}
var NUM = { type: "number" }, STR = { type: "string" }, BOOL = { type: "boolean" };
var NUM_OR_NULL = { anyOf: [NUM, { type: "null" }] }, STR_OR_NULL = { anyOf: [STR, { type: "null" }] };
var PER100 = obj({ kcal: NUM, protein: NUM, fat: NUM, carb: NUM });
var PORTIONS = { type: "array", items: obj({ label: STR, grams: NUM }) };
export var SCHEMA_LABEL = obj({
  name: STR, per_100g: PER100, portions: PORTIONS, default_portion: STR,
  pack_grams: NUM_OR_NULL, pack_kcal: NUM_OR_NULL, note: STR,
  read: obj({ kcal: BOOL, protein: BOOL, fat: BOOL, carb: BOOL }),
  search: STR, barcode: STR_OR_NULL
});
export var SCHEMA_MEAL = obj({
  items: { type: "array", items: obj({ name: STR, grams: NUM, per_100g: PER100, portions: PORTIONS }) },
  note: STR
});

/* 照片（canvas 导出的 data:image/jpeg;base64,…）→ Claude 的 image 内容块 */
export function imageBlock(dataUrl) {
  var m = /^data:([^;,]+);base64,(.*)$/.exec(String(dataUrl));
  if (!m) throw new Error("图片格式不对");
  return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
}

/* 回复 → 文字。被拒、被截断、没有文字都当失败；思考块、联网搜索的过程块跳过，
   联网搜索时文字会按引用切成好几段，按顺序拼回去 */
export function replyText(r) {
  if (!r) throw new Error("空回复");
  if (r.stop_reason === "refusal") {
    throw new Error("Claude 拒绝了这次请求" + (r.stop_details && r.stop_details.category ? "（" + r.stop_details.category + "）" : "") +
      "，换张照片或换个说法再试");
  }
  if (r.stop_reason === "max_tokens") throw new Error("回复太长被截断了");
  var txt = (r.content || []).filter(function (b) { return b && b.type === "text"; }).map(function (b) { return b.text; }).join("");
  if (!txt.trim()) throw new Error("空回复");
  return txt;
}

/* 出错时给人看的一句话：按 SDK 的错误类型分，不去匹配错误文字 */
export function aiErrText(e, timeoutS) {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "超时：等了 " + timeoutS + " 秒没回复，网络慢或服务忙，过会儿再试";
  if (e instanceof Anthropic.APIConnectionError) return "连不上 Anthropic：检查一下网络";
  if (e instanceof Anthropic.APIError && e.status) {
    var msg = e.error && e.error.error && e.error.error.message ? String(e.error.error.message).slice(0, 160) : "";
    var why = e instanceof Anthropic.AuthenticationError ? "密钥无效：去「导出」页重新粘贴 Anthropic 密钥"
      : e instanceof Anthropic.PermissionDeniedError ? "这个密钥没有权限"
      : e instanceof Anthropic.RateLimitError ? "请求太频繁或到了用量上限，稍后再试；用量和上限在 Claude Console 里看"
      : e.status === 529 ? "Anthropic 服务繁忙，稍后再试"
      : e instanceof Anthropic.InternalServerError ? "Anthropic 服务出错，稍后再试"
      : "";
    return "HTTP " + e.status + (why ? "（" + why + "）" : "") + (msg ? "：" + msg : "");
  }
  return e && e.message ? e.message : String(e);
}

import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { SCHEMA_LABEL, SCHEMA_MEAL, aiErrText, imageBlock, replyText } from "../../src/lib/claude.js";
import { aiParseFood, aiParseMeal } from "../../src/lib/parse.js";

// Every object node must list all its properties as required and set additionalProperties: false,
// and must not use keywords structured outputs rejects (numeric / string-length constraints).
function walk(node, path, out) {
  if (!node || typeof node !== "object") return out;
  for (const k of ["minimum", "maximum", "multipleOf", "minLength", "maxLength", "exclusiveMinimum", "exclusiveMaximum"]) {
    if (k in node) out.push(path + ": unsupported " + k);
  }
  if (node.type === "object") {
    if (node.additionalProperties !== false) out.push(path + ": additionalProperties must be false");
    const keys = Object.keys(node.properties || {});
    if (JSON.stringify([...(node.required || [])].sort()) !== JSON.stringify([...keys].sort())) out.push(path + ": required != properties");
    keys.forEach(k => walk(node.properties[k], path + "." + k, out));
  }
  if (node.items) walk(node.items, path + "[]", out);
  (node.anyOf || []).forEach((n, i) => walk(n, path + "|" + i, out));
  return out;
}

describe("structured output schemas", () => {
  it("only use what output_config.format accepts", () => {
    expect(walk(SCHEMA_LABEL, "label", [])).toEqual([]);
    expect(walk(SCHEMA_MEAL, "meal", [])).toEqual([]);
  });
  it("describe objects the existing parsers accept", () => {
    const label = { name: "Tesco 希腊酸奶", per_100g: { kcal: 120, protein: 5, fat: 9.6, carb: 3.9 },
      portions: [{ label: "一份", grams: 150 }], default_portion: "一份", pack_grams: null, pack_kcal: null, note: "实读",
      read: { kcal: true, protein: true, fat: true, carb: true }, search: "Tesco Greek Yogurt", barcode: null };
    expect(Object.keys(label).sort()).toEqual([...SCHEMA_LABEL.required].sort());
    expect(aiParseFood(JSON.stringify(label)).unread).toEqual([]);
    const meal = { items: [{ name: "米饭", grams: 180, per_100g: { kcal: 116, protein: 2.6, fat: 0.3, carb: 25.9 },
      portions: [{ label: "中碗", grams: 180 }] }], note: "" };
    expect(Object.keys(meal).sort()).toEqual([...SCHEMA_MEAL.required].sort());
    expect(aiParseMeal(JSON.stringify(meal)).items[0].grams).toBe(180);
  });
});

describe("imageBlock", () => {
  it("turns a canvas data URL into a base64 image block", () => {
    expect(imageBlock("data:image/jpeg;base64,AAAA")).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
    expect(() => imageBlock("blob:xyz")).toThrow();
  });
});

describe("replyText", () => {
  const msg = (content, stop_reason = "end_turn", extra = {}) => ({ type: "message", role: "assistant", content, stop_reason, ...extra });
  it("joins text blocks and skips thinking and web-search blocks", () => {
    expect(replyText(msg([
      { type: "thinking", thinking: "", signature: "x" },
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "q" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [] },
      { type: "text", text: '{"found":true,', citations: [{ type: "web_search_result_location" }] },
      { type: "text", text: '"x":1}' },
    ]))).toBe('{"found":true,"x":1}');
  });
  it("fails on refusals, truncation and empty replies", () => {
    expect(() => replyText(msg([], "refusal", { stop_details: { type: "refusal", category: "general_harms" } }))).toThrow(/拒绝.*general_harms/);
    expect(() => replyText(msg([{ type: "text", text: "{" }], "max_tokens"))).toThrow(/截断/);
    expect(() => replyText(msg([{ type: "thinking", thinking: "" }]))).toThrow(/空回复/);
    expect(() => replyText(null)).toThrow(/空回复/);
  });
});

describe("aiErrText", () => {
  const headers = new Headers();
  const body = (type, message) => ({ type: "error", error: { type, message } });
  it("explains the common API errors by type, with the server's message", () => {
    expect(aiErrText(Anthropic.APIError.generate(401, body("authentication_error", "invalid x-api-key"), undefined, headers), 1, Anthropic))
      .toBe("HTTP 401（密钥无效：去「导出」页重新粘贴 Anthropic 密钥）：invalid x-api-key");
    expect(aiErrText(Anthropic.APIError.generate(429, body("rate_limit_error", "slow down"), undefined, headers), 1, Anthropic)).toMatch(/^HTTP 429（请求太频繁/);
    expect(aiErrText(Anthropic.APIError.generate(529, body("overloaded_error", "Overloaded"), undefined, headers), 1, Anthropic)).toMatch(/^HTTP 529（Anthropic 服务繁忙/);
    expect(aiErrText(Anthropic.APIError.generate(400, body("invalid_request_error", "Your credit balance is too low"), undefined, headers), 1, Anthropic))
      .toBe("HTTP 400：Your credit balance is too low");
  });
  it("tells timeouts and network failures apart, quoting the real wait (the SDK retries a timeout once)", () => {
    expect(aiErrText(new Anthropic.APIConnectionTimeoutError(), 121, Anthropic)).toMatch(/^超时：等了约 121 秒/);
    expect(aiErrText(new Anthropic.APIConnectionError({ message: "x" }), 3, Anthropic)).toMatch(/^连不上/);
    expect(aiErrText(new Error("空回复"), 1, Anthropic)).toBe("空回复");
  });
  it("falls back to the plain message when the SDK itself failed to load", () => {
    expect(aiErrText(new Error("AI 模块没加载成功"), 0, null)).toBe("AI 模块没加载成功");
  });
});

import { describe, expect, it } from "vitest";
import { CA_DEFAULT_MODEL, CA_MODEL_OPTS, caBody, caHttpError, caReplyText, toOpenAIContent } from "../../src/lib/chatanywhere.js";
import { imageBlock } from "../../src/lib/claude.js";

describe("ChatAnywhere request shape", () => {
  it("turns Claude image/text blocks into chat-completions parts", () => {
    const content = [imageBlock("data:image/jpeg;base64,AAAA"), { type: "text", text: "识别这个食物" }];
    expect(toOpenAIContent(content)).toEqual([
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
      { type: "text", text: "识别这个食物" },
    ]);
    expect(toOpenAIContent("plain")).toBe("plain");
  });
  it("puts the system prompt first and only sends temperature to models that accept it", () => {
    const b = caBody("claude-sonnet-5-5", "SYS", [{ type: "text", text: "hi" }]);
    expect(b).toEqual({ model: "claude-sonnet-5-5", messages: [{ role: "system", content: "SYS" }, { role: "user", content: [{ type: "text", text: "hi" }] }] });
    expect(caBody("gpt-4.1-mini", "S", "q").temperature).toBe(0);
    expect(caBody("gpt-4o-mini-search-preview", "S", "q").temperature).toBeUndefined();
  });
  it("defaults to claude-sonnet-5-5 and lists it first", () => {
    expect(CA_DEFAULT_MODEL).toBe("claude-sonnet-5-5");
    expect(CA_MODEL_OPTS[0][0]).toBe(CA_DEFAULT_MODEL);
  });
});

describe("ChatAnywhere replies and errors", () => {
  it("reads the first choice's text and rejects empty replies", () => {
    expect(caReplyText({ choices: [{ message: { content: '{"a":1}' } }] })).toBe('{"a":1}');
    expect(() => caReplyText({ choices: [{ message: { content: "  " } }] })).toThrow(/空回复/);
    expect(() => caReplyText(null)).toThrow(/空回复/);
  });
  it("explains common HTTP errors and keeps the status", () => {
    const e = caHttpError(401, "bad key");
    expect(e.status).toBe(401);
    expect(e.message).toBe("ChatAnywhere HTTP 401（ChatAnywhere 密钥无效？去「导出」页重新粘贴）：bad key");
    expect(caHttpError(400).message).toMatch(/换个模型/);
  });
});

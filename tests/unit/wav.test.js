import { describe, expect, it } from "vitest";
import { bytesToBase64, encodeWav } from "../../src/lib/wav.js";

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header and clamps samples", () => {
    const w = encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
    const v = new DataView(w.buffer);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...w.slice(8, 12))).toBe("WAVE");
    expect(v.getUint32(4, true)).toBe(36 + 8);
    expect(v.getUint16(22, true)).toBe(1);        // mono
    expect(v.getUint32(24, true)).toBe(16000);    // sample rate
    expect(v.getUint16(34, true)).toBe(16);       // bits
    expect(v.getUint32(40, true)).toBe(8);        // data bytes
    expect([0, 1, 2, 3].map(i => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});

describe("bytesToBase64", () => {
  it("matches Buffer for large inputs", () => {
    const b = new Uint8Array(70000).map((_, i) => (i * 7) & 255);
    expect(bytesToBase64(b)).toBe(Buffer.from(b).toString("base64"));
  });
});

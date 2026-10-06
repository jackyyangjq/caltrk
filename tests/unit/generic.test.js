import { describe, expect, it } from "vitest";
import { matchScore } from "../../src/generic.js";

const f = { name: "鸡胸肉（去皮，烤）", aka: "鸡胸|chicken breast", en: "Chicken, broilers or fryers, breast, meat only, cooked, roasted" };

describe("generic food matching", () => {
  it("ranks exact alias, prefix, contains, alias-contains, English", () => {
    expect(matchScore(f, "鸡胸")).toBe(0);
    expect(matchScore(f, "鸡胸肉")).toBe(1);
    expect(matchScore(f, "去皮")).toBe(2);
    expect(matchScore(f, "chicken")).toBe(3);
    expect(matchScore(f, "roasted")).toBe(4);
    expect(matchScore(f, "牛肉")).toBe(-1);
  });
});

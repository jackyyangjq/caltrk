import { describe, expect, it } from "vitest";
import { QUICK_N, autoCount, autoPool, dropQuick, isPinned, normQuick, pinQuick } from "../../src/lib/quick.js";

describe("quick-record selection", () => {
  const empty = { pins: [], hidden: [] };
  it("puts a newly added food first and takes it out of the removed list", () => {
    let q = pinQuick(empty, "a");
    q = pinQuick(q, "b");
    expect(q.pins).toEqual(["b", "a"]);
    q = dropQuick(q, "a");
    expect(q).toEqual({ pins: ["b"], hidden: ["a"] });
    q = pinQuick(q, "a");
    expect(q).toEqual({ pins: ["a", "b"], hidden: [] });
    expect(isPinned(q, "a")).toBe(true);
  });
  it("re-adding a pinned food moves it to the front without duplicating; removing twice is harmless", () => {
    const q = pinQuick({ pins: ["a", "b", "c"], hidden: [] }, "c");
    expect(q.pins).toEqual(["c", "a", "b"]);
    expect(dropQuick(dropQuick(q, "x"), "x").hidden).toEqual(["x"]);
  });
  it("does not mutate the state it is given", () => {
    const q = { pins: ["a"], hidden: [] };
    pinQuick(q, "b"); dropQuick(q, "a");
    expect(q).toEqual({ pins: ["a"], hidden: [] });
  });
  it("auto-fill skips pinned and removed foods and only fills up to QUICK_N", () => {
    const foods = ["a", "b", "c", "d"].map(id => ({ id }));
    const q = { pins: ["a"], hidden: ["c"] };
    expect(autoPool(foods, q).map(f => f.id)).toEqual(["b", "d"]);
    expect(autoCount(q)).toBe(QUICK_N - 1);
    expect(autoCount({ pins: Array.from({ length: 12 }, (_, i) => "p" + i), hidden: [] })).toBe(0);
  });
  it("follows merged foods (UF_SAME_AS), drops duplicates and junk, and a pinned id is never also removed", () => {
    const q = normQuick({ pins: ["uf-old", "lib-x", "lib-x", null, 3], hidden: ["lib-x", "uf-gone", "uf-gone"] }, { "uf-old": "lib-x" });
    expect(q).toEqual({ pins: ["lib-x"], hidden: ["uf-gone"] });
    expect(normQuick(undefined, {})).toEqual({ pins: [], hidden: [] });
  });
});

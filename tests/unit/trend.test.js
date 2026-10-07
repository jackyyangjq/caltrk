import { describe, expect, it } from "vitest";
import { dateShift } from "../../src/lib/util.js";
import { dailyTrend, morningPoints, niceTicks, rateVerdict, trendRate } from "../../src/lib/trend.js";

describe("morningPoints", () => {
  it("keeps morning weights only, one per day, sorted", () => {
    expect(morningPoints([
      { date: "2026-10-03", kg: 82, context: "morning" },
      { date: "2026-10-01", kg: 83, context: "morning" },
      { date: "2026-10-01", kg: 84, context: "gym_pre" },
      { date: "2026-10-02", kg: 0, context: "morning" },
    ])).toEqual([{ date: "2026-10-01", kg: 83 }, { date: "2026-10-03", kg: 82 }]);
  });
});

describe("dailyTrend", () => {
  it("smooths with alpha and fills gaps by interpolation", () => {
    const s = dailyTrend([{ date: "2026-10-01", kg: 80 }, { date: "2026-10-03", kg: 82 }], 0.5);
    expect(s.map(x => x.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(s.map(x => x.kg)).toEqual([80, null, 82]);
    expect(s[1].trend).toBeCloseTo(80.5);   // 80 + .5 × (81 − 80)
    expect(s[2].trend).toBeCloseTo(81.25);  // 80.5 + .5 × (82 − 80.5)
  });
  it("is empty without weigh-ins and crosses the clock change", () => {
    expect(dailyTrend([])).toEqual([]);
    expect(dailyTrend([{ date: "2026-10-24", kg: 80 }, { date: "2026-10-27", kg: 80 }]).length).toBe(4);
  });
  it("converges on a steady linear loss with ~9 days of lag", () => {
    const pts = [];
    for (let i = 0; i < 60; i++) pts.push({ date: dateShift("2026-08-01", i), kg: 85 - 0.07 * i });
    const s = dailyTrend(pts);
    expect(trendRate(s, 14)).toBeCloseTo(-0.49, 2);
    expect(s[s.length - 1].kg - s[s.length - 1].trend).toBeCloseTo(-0.07 * 9, 1);
  });
});

describe("trendRate / rateVerdict", () => {
  const s = [0, 1, 2, 3, 4, 5, 6, 7].map((i, k) => ({ trend: 80 - 0.1 * k }));
  it("needs more than `days` points", () => {
    expect(trendRate(s, 7)).toBeCloseTo(-0.7);
    expect(trendRate(s, 8)).toBeNull();
  });
  it("classifies against the planned loss band", () => {
    expect(rateVerdict(-0.45, [0.4, 0.5])).toBe("on");
    expect(rateVerdict(-0.2, [0.4, 0.5])).toBe("slow");
    expect(rateVerdict(0.1, [0.4, 0.5])).toBe("slow");
    expect(rateVerdict(-0.8, [0.4, 0.5])).toBe("fast");
    expect(rateVerdict(null, [0.4, 0.5])).toBeNull();
  });
});

describe("niceTicks", () => {
  it("picks round steps", () => {
    expect(niceTicks(81.2, 83.1)).toEqual([81.5, 82, 82.5, 83]);
    expect(niceTicks(0, 2800)).toEqual([0, 1000, 2000]);
  });
});

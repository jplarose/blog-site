import { describe, expect, it } from "vitest";

import {
  axisTicks,
  barGeometry,
  formatUtcDateLabel,
  isAllZeroSeries,
  niceAxisMax,
  sparseTickIndices,
  type DailyViewPoint,
} from "@/lib/dashboard/chartMath";

describe("niceAxisMax", () => {
  it("rounds up to a nice ceiling above the raw max", () => {
    expect(niceAxisMax(37)).toBe(50);
    expect(niceAxisMax(3)).toBe(5);
    expect(niceAxisMax(120)).toBe(200);
    expect(niceAxisMax(500)).toBe(500);
  });

  it("returns a positive ceiling for an all-zero series instead of 0", () => {
    expect(niceAxisMax(0)).toBeGreaterThan(0);
  });

  it("never returns less than the input value", () => {
    for (const value of [1, 9, 10, 99, 100, 999, 1000]) {
      expect(niceAxisMax(value)).toBeGreaterThanOrEqual(value);
    }
  });
});

describe("axisTicks", () => {
  it("produces tickCount + 1 evenly spaced whole-number ticks from 0 to axisMax", () => {
    expect(axisTicks(40, 4)).toEqual([0, 10, 20, 30, 40]);
  });

  it("defaults to 4 intervals", () => {
    expect(axisTicks(100)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe("formatUtcDateLabel", () => {
  it("formats a YYYY-MM-DD string as a short UTC month/day label", () => {
    expect(formatUtcDateLabel("2026-07-05")).toBe("Jul 5");
    expect(formatUtcDateLabel("2026-01-31")).toBe("Jan 31");
    expect(formatUtcDateLabel("2026-12-01")).toBe("Dec 1");
  });

  it("does not drift a day regardless of the host timezone (no local Date parsing)", () => {
    // A naive `new Date("2026-07-01")` interpreted in a negative-UTC-offset
    // timezone would render as "Jun 30". This must stay "Jul 1".
    expect(formatUtcDateLabel("2026-07-01")).toBe("Jul 1");
  });
});

describe("sparseTickIndices", () => {
  it("always includes the first and last index", () => {
    const indices = sparseTickIndices(30, 7);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(29);
  });

  it("spaces labels roughly weekly for a 30-point series, well under 30 labels", () => {
    const indices = sparseTickIndices(30, 7);
    expect(indices.length).toBeLessThanOrEqual(7);
    expect(indices.length).toBeGreaterThanOrEqual(4);
  });

  it("handles a single point without duplicating index 0", () => {
    expect(sparseTickIndices(1)).toEqual([0]);
  });

  it("handles zero points", () => {
    expect(sparseTickIndices(0)).toEqual([]);
  });
});

describe("barGeometry", () => {
  const width = 300;
  const height = 100;

  it("scales bar height proportionally to viewCount against axisMax", () => {
    const points: DailyViewPoint[] = [
      { date: "2026-07-01", viewCount: 0 },
      { date: "2026-07-02", viewCount: 50 },
      { date: "2026-07-03", viewCount: 100 },
    ];
    const bars = barGeometry(points, 100, { width, height });

    expect(bars).toHaveLength(3);
    expect(bars[2].height).toBeCloseTo(height, 0);
    expect(bars[1].height).toBeCloseTo(height / 2, 0);
    // Zero-value bars still get a visible sliver, not a collapsed 0px bar.
    expect(bars[0].height).toBeGreaterThan(0);
  });

  it("keeps bars within the plot width and in date order left-to-right", () => {
    const points: DailyViewPoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      viewCount: i,
    }));
    const bars = barGeometry(points, 9, { width, height });

    for (const bar of bars) {
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(width + 0.01);
    }
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].x).toBeGreaterThan(bars[i - 1].x);
    }
  });

  it("returns an empty array for an empty series", () => {
    expect(barGeometry([], 10, { width, height })).toEqual([]);
  });

  it("does not divide by zero when axisMax is 0 (all-zero series)", () => {
    const points: DailyViewPoint[] = [
      { date: "2026-07-01", viewCount: 0 },
      { date: "2026-07-02", viewCount: 0 },
    ];
    const bars = barGeometry(points, 0, { width, height });
    expect(bars.every((bar) => Number.isFinite(bar.height))).toBe(true);
  });
});

describe("isAllZeroSeries", () => {
  it("is true when every point is zero", () => {
    expect(isAllZeroSeries([{ date: "2026-07-01", viewCount: 0 }])).toBe(true);
  });

  it("is false when any point is nonzero", () => {
    expect(
      isAllZeroSeries([
        { date: "2026-07-01", viewCount: 0 },
        { date: "2026-07-02", viewCount: 1 },
      ]),
    ).toBe(false);
  });

  it("is true for an empty series", () => {
    expect(isAllZeroSeries([])).toBe(true);
  });
});

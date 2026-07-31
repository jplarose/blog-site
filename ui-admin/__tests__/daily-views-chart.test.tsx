import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DailyViewsChart from "@/components/dashboard/DailyViewsChart";
import type { DailyViewPoint } from "@/lib/dashboard/chartMath";

function makeDailyViews(viewCounts: number[]): DailyViewPoint[] {
  return viewCounts.map((viewCount, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    viewCount,
  }));
}

describe("DailyViewsChart", () => {
  afterEach(() => cleanup());

  it("renders an accessible SVG with a summarizing aria-label", () => {
    const dailyViews = makeDailyViews([1, 2, 30, 4, 5]);
    render(<DailyViewsChart dailyViews={dailyViews} />);

    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("30");
    expect(chart.getAttribute("aria-label")).toContain("Jul 3");
  });

  it("includes a visually-hidden data table with every date/viewCount pair", () => {
    const dailyViews = makeDailyViews([3, 7]);
    render(<DailyViewsChart dailyViews={dailyViews} />);

    expect(screen.getByText("2026-07-01").closest("td")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows a flat baseline note for an all-zero series", () => {
    const dailyViews = makeDailyViews([0, 0, 0]);
    render(<DailyViewsChart dailyViews={dailyViews} />);

    expect(screen.getByText("No views in this period.")).toBeInTheDocument();
  });

  it("does not show the all-zero note when there is traffic", () => {
    const dailyViews = makeDailyViews([0, 5, 0]);
    render(<DailyViewsChart dailyViews={dailyViews} />);

    expect(screen.queryByText("No views in this period.")).not.toBeInTheDocument();
  });

  it("renders one bar per day", () => {
    const dailyViews = makeDailyViews(Array.from({ length: 30 }, (_, i) => i));
    const { container } = render(<DailyViewsChart dailyViews={dailyViews} />);

    expect(container.querySelectorAll("rect")).toHaveLength(30);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AnalyticsPage from "@/app/(admin)/analytics/page";
import { ApiError, type AnalyticsSummary } from "@/lib/api";

const summary = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    analyticsApi: { ...actual.analyticsApi, summary: (...args: unknown[]) => summary(...args) },
  };
});

const zeroTrafficSummary: AnalyticsSummary = {
  totalPageViews: 0,
  uniqueVisitors: 0,
  totalPosts: 4,
  publishedPosts: 2,
  draftPosts: 2,
  scheduledPosts: 0,
  archivedPosts: 0,
  topPosts: [],
  dailyViews: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    viewCount: 0,
  })),
};

const populatedSummary: AnalyticsSummary = {
  ...zeroTrafficSummary,
  totalPageViews: 1500,
  uniqueVisitors: 640,
  topPosts: [{ postId: 3, title: "Great Post", slug: "great-post", viewCount: 250 }],
  dailyViews: zeroTrafficSummary.dailyViews.map((point, i) => ({ ...point, viewCount: i * 2 })),
};

describe("AnalyticsPage", () => {
  afterEach(() => {
    cleanup();
    summary.mockReset();
  });

  it("renders the full stat breakdown from the analytics contract", async () => {
    summary.mockResolvedValue(populatedSummary);

    render(<AnalyticsPage />);

    expect(await screen.findByText("1500")).toBeInTheDocument();
    expect(screen.getByText("640")).toBeInTheDocument();
    expect(summary).toHaveBeenCalledWith(30);
  });

  it("stays understandable with an all-zero series and an empty top posts list", async () => {
    summary.mockResolvedValue(zeroTrafficSummary);

    render(<AnalyticsPage />);

    await screen.findByText(/no views yet/i);
    expect(screen.getByText("No views in this period.")).toBeInTheDocument();
  });

  it("shows a friendly error with a retry affordance on failure", async () => {
    summary.mockRejectedValue(new Error("Server error"));

    render(<AnalyticsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");

    const retryButton = screen.getByRole("button", { name: "Retry" });
    summary.mockResolvedValueOnce(populatedSummary);
    fireEvent.click(retryButton);

    await waitFor(() => expect(summary).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("1500")).toBeInTheDocument();
  });

  it("shows a generic message for a 500 ApiError, never the raw backend body", async () => {
    summary.mockRejectedValue(
      new ApiError(500, "API error 500: Unhandled exception at AnalyticsController line 42"),
    );

    render(<AnalyticsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load analytics.");
    expect(alert.textContent).not.toContain("Unhandled exception");
    expect(alert.textContent).not.toContain("AnalyticsController");
  });
});

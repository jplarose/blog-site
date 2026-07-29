import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "@/app/(admin)/dashboard/page";
import { ApiError, type AnalyticsSummary } from "@/lib/api";

const summary = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    analyticsApi: { ...actual.analyticsApi, summary: (...args: unknown[]) => summary(...args) },
  };
});

const sampleSummary: AnalyticsSummary = {
  totalPageViews: 500,
  uniqueVisitors: 200,
  totalPosts: 12,
  publishedPosts: 8,
  draftPosts: 3,
  scheduledPosts: 1,
  archivedPosts: 0,
  topPosts: [{ postId: 7, title: "Popular Post", slug: "popular-post", viewCount: 99 }],
  dailyViews: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    viewCount: i,
  })),
};

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
    summary.mockReset();
  });

  it("requests the 30-day analytics summary and renders the stat tiles", async () => {
    summary.mockResolvedValue(sampleSummary);

    render(<DashboardPage />);

    const publishedLink = await screen.findByRole("link", { name: /Published/ });
    expect(publishedLink).toHaveTextContent("8");
    expect(summary).toHaveBeenCalledWith(30);
  });

  it("renders the top posts list once loaded", async () => {
    summary.mockResolvedValue(sampleSummary);

    render(<DashboardPage />);

    expect(await screen.findByRole("link", { name: "Popular Post" })).toHaveAttribute(
      "href",
      "/posts/7",
    );
  });

  it("shows a friendly error with a retry affordance when the summary request fails", async () => {
    summary.mockRejectedValue(new Error("Network unreachable"));

    render(<DashboardPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unreachable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a generic message for a 500 ApiError, never the raw backend body", async () => {
    summary.mockRejectedValue(
      new ApiError(500, "API error 500: Unhandled exception at AnalyticsController line 42"),
    );

    render(<DashboardPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load analytics.");
    expect(alert.textContent).not.toContain("Unhandled exception");
    expect(alert.textContent).not.toContain("AnalyticsController");
  });

  it("retries the summary request when Retry is clicked", async () => {
    summary.mockRejectedValueOnce(new Error("Network unreachable"));
    summary.mockResolvedValueOnce(sampleSummary);

    render(<DashboardPage />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(summary).toHaveBeenCalledTimes(2));
    const publishedLink = await screen.findByRole("link", { name: /Published/ });
    expect(publishedLink).toHaveTextContent("8");
  });
});

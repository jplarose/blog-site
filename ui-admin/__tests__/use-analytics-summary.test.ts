import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const summary = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    analyticsApi: { ...actual.analyticsApi, summary: (...args: unknown[]) => summary(...args) },
  };
});

describe("useAnalyticsSummary", () => {
  afterEach(() => {
    cleanup();
    summary.mockReset();
  });

  it("shows a generic message for a 500 ApiError, never the raw backend body", async () => {
    const { ApiError } = await import("@/lib/api");
    const { useAnalyticsSummary } = await import("@/lib/dashboard/useAnalyticsSummary");
    summary.mockRejectedValue(
      new ApiError(500, "API error 500: Unhandled exception at Analytics.Controller line 42"),
    );

    const { result } = renderHook(() => useAnalyticsSummary(30));

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    const state = result.current.state;
    if (state.status !== "error") throw new Error("expected error state");
    expect(state.message).toBe("Failed to load analytics.");
    expect(state.message).not.toContain("Unhandled exception");
    expect(state.message).not.toContain("Analytics.Controller");
  });

  it("passes through the server's own message for a 400 ApiError", async () => {
    const { ApiError } = await import("@/lib/api");
    const { useAnalyticsSummary } = await import("@/lib/dashboard/useAnalyticsSummary");
    summary.mockRejectedValue(new ApiError(400, "API error 400: days must be between 1 and 365"));

    const { result } = renderHook(() => useAnalyticsSummary(30));

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    const state = result.current.state;
    if (state.status !== "error") throw new Error("expected error state");
    expect(state.message).toBe("days must be between 1 and 365");
  });

  it("falls back to the plain Error message for a non-ApiError failure (e.g. network error)", async () => {
    const { useAnalyticsSummary } = await import("@/lib/dashboard/useAnalyticsSummary");
    summary.mockRejectedValue(new Error("Network unreachable"));

    const { result } = renderHook(() => useAnalyticsSummary(30));

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    const state = result.current.state;
    if (state.status !== "error") throw new Error("expected error state");
    expect(state.message).toBe("Network unreachable");
  });

  it("resolves to a ready state with the fetched summary on success", async () => {
    const { useAnalyticsSummary } = await import("@/lib/dashboard/useAnalyticsSummary");
    const data = {
      totalPageViews: 10,
      uniqueVisitors: 5,
      totalPosts: 1,
      publishedPosts: 1,
      draftPosts: 0,
      scheduledPosts: 0,
      archivedPosts: 0,
      topPosts: [],
      dailyViews: [],
    };
    summary.mockResolvedValue(data);

    const { result } = renderHook(() => useAnalyticsSummary(30));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const state = result.current.state;
    if (state.status !== "ready") throw new Error("expected ready state");
    expect(state.data).toEqual(data);
  });
});

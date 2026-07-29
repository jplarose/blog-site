"use client";

import AnalyticsErrorState from "@/components/dashboard/AnalyticsErrorState";
import DailyViewsChart from "@/components/dashboard/DailyViewsChart";
import StatTile from "@/components/dashboard/StatTile";
import TopPostsList from "@/components/dashboard/TopPostsList";
import { useAnalyticsSummary } from "@/lib/dashboard/useAnalyticsSummary";

/**
 * Analytics is the detailed 30-day report: every stat the contract returns
 * (views, unique visitors, and the full post-state breakdown), the
 * full-size daily views chart, and the top-posts table. The dashboard shows
 * a trimmed subset of this with a link here for the rest.
 *
 * The previous placeholder had a 7d/30d/90d/1y range selector, but the
 * analytics contract (#42) only guarantees a fixed 30-day window for this
 * task — that control is dropped rather than shipped non-functional.
 */
export default function AnalyticsPage() {
  const { state, reload } = useAnalyticsSummary(30);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Site traffic and post performance — last 30 days</p>
      </div>

      <div aria-live="polite" className="sr-only">
        {state.status === "loading" ? "Loading analytics…" : null}
        {state.status === "ready" ? "Analytics loaded." : null}
      </div>

      {state.status === "error" ? (
        <AnalyticsErrorState message={state.message} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total Page Views"
              value={state.status === "ready" ? state.data.totalPageViews : "—"}
              caption="Last 30 days"
            />
            <StatTile
              label="Unique Visitors"
              value={state.status === "ready" ? state.data.uniqueVisitors : "—"}
              caption="Last 30 days"
            />
            <StatTile
              label="Published Posts"
              value={state.status === "ready" ? state.data.publishedPosts : "—"}
              href="/posts?status=Published"
            />
            <StatTile
              label="Draft Posts"
              value={state.status === "ready" ? state.data.draftPosts : "—"}
              href="/posts?status=Draft"
            />
            <StatTile
              label="Scheduled Posts"
              value={state.status === "ready" ? state.data.scheduledPosts : "—"}
              href="/posts?status=Scheduled"
            />
            <StatTile
              label="Archived Posts"
              value={state.status === "ready" ? state.data.archivedPosts : "—"}
              href="/posts?status=Archived"
            />
            <StatTile
              label="Total Posts"
              value={state.status === "ready" ? state.data.totalPosts : "—"}
              href="/posts"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Daily Page Views</h2>
            {state.status === "ready" ? (
              <DailyViewsChart dailyViews={state.data.dailyViews} />
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
                Loading chart…
              </div>
            )}
          </div>

          {state.status === "ready" ? <TopPostsList topPosts={state.data.topPosts} /> : null}
        </>
      )}
    </div>
  );
}

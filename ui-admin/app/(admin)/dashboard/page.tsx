"use client";

import Link from "next/link";

import AnalyticsErrorState from "@/components/dashboard/AnalyticsErrorState";
import DailyViewsChart from "@/components/dashboard/DailyViewsChart";
import StatTile from "@/components/dashboard/StatTile";
import TopPostsList from "@/components/dashboard/TopPostsList";
import { useAnalyticsSummary } from "@/lib/dashboard/useAnalyticsSummary";

/**
 * Dashboard is the compact overview: headline stat tiles, a small daily
 * views chart, and the top-5 posts, all linking out to the fuller /analytics
 * page or the filtered posts list. Deeper breakdowns (unique visitors, the
 * full post-state split, the full-size chart) live on /analytics so the two
 * nav entries stay distinct rather than duplicating one page.
 */
export default function DashboardPage() {
  const { state, reload } = useAnalyticsSummary(30);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back to BlogSite Admin</p>
      </div>

      <div aria-live="polite" className="sr-only">
        {state.status === "loading" ? "Loading dashboard analytics…" : null}
        {state.status === "ready" ? "Dashboard analytics loaded." : null}
      </div>

      {state.status === "error" ? (
        <AnalyticsErrorState message={state.message} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total Posts"
              value={state.status === "ready" ? state.data.totalPosts : "—"}
              href="/posts"
            />
            <StatTile
              label="Published"
              value={state.status === "ready" ? state.data.publishedPosts : "—"}
              href="/posts?status=Published"
            />
            <StatTile
              label="Drafts"
              value={state.status === "ready" ? state.data.draftPosts : "—"}
              href="/posts?status=Draft"
            />
            <StatTile
              label="Page Views (30d)"
              value={state.status === "ready" ? state.data.totalPageViews : "—"}
              href="/analytics"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700">Daily Page Views</h2>
              <Link href="/analytics" className="text-sm text-indigo-600 hover:text-indigo-500 hover:underline">
                View full analytics &rarr;
              </Link>
            </div>
            {state.status === "ready" ? (
              <DailyViewsChart dailyViews={state.data.dailyViews} compact />
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                Loading chart…
              </div>
            )}
          </div>

          {state.status === "ready" ? <TopPostsList topPosts={state.data.topPosts} /> : null}
        </>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/posts/new"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            + New Post
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Manage Categories
          </Link>
          <Link
            href="/analytics"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}

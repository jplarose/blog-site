import Link from "next/link";

import type { AnalyticsSummary } from "@/lib/api";

interface TopPostsListProps {
  topPosts: AnalyticsSummary["topPosts"];
  title?: string;
}

/**
 * Ranked list of the top-performing posts by view count, each linking to
 * its admin editor. The analytics contract already returns this pre-sorted
 * and capped at 5 entries, so no client-side sorting/slicing happens here.
 */
export default function TopPostsList({ topPosts, title = "Top Posts" }: TopPostsListProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Post
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Views
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {topPosts.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-400">
                No views yet — top posts will appear here once readers start visiting.
              </td>
            </tr>
          ) : (
            topPosts.map((post) => (
              <tr key={post.postId}>
                <td className="px-6 py-3 text-sm">
                  <Link
                    href={`/posts/${post.postId}`}
                    className="text-indigo-600 hover:text-indigo-500 hover:underline"
                  >
                    {post.title}
                  </Link>
                </td>
                <td className="px-6 py-3 text-right text-sm tabular-nums text-gray-700">
                  {post.viewCount}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

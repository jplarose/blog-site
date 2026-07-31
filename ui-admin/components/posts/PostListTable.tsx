import Link from "next/link";

import PostRowActions from "@/components/posts/PostRowActions";
import PostStatusBadge from "@/components/posts/PostStatusBadge";
import type { Post, PostSummary } from "@/lib/api";

interface PostListTableProps {
  posts: PostSummary[];
  isLoading: boolean;
  onChanged: (updatedPost: Post) => void;
  onDeleted: (postId: number) => void;
  onRowError: (message: string) => void;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function rowDateLabel(post: PostSummary): string {
  if (post.status === "Scheduled" && post.scheduledAt) return `Scheduled ${formatDate(post.scheduledAt)}`;
  if (post.status === "Published" && post.publishedAt) return `Published ${formatDate(post.publishedAt)}`;
  return formatDate(post.updatedAt);
}

/** Post list table body: loading skeleton, empty state, and populated rows. */
export default function PostListTable({ posts, isLoading, onChanged, onDeleted, onRowError }: PostListTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                Loading posts…
              </td>
            </tr>
          ) : posts.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                No posts match these filters.{" "}
                <Link href="/posts/new" className="text-indigo-600 hover:underline">
                  Create a post
                </Link>
                .
              </td>
            </tr>
          ) : (
            posts.map((post) => (
              <tr key={post.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  <Link href={`/posts/${post.id}`} className="hover:underline">
                    {post.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{post.categoryName ?? "—"}</td>
                <td className="px-6 py-4 text-sm">
                  <PostStatusBadge status={post.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{rowDateLabel(post)}</td>
                <td className="px-6 py-4">
                  <PostRowActions post={post} onChanged={onChanged} onDeleted={onDeleted} onError={onRowError} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

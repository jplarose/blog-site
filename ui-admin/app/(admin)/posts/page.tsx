import Link from "next/link";

export default function PostsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your blog posts</p>
        </div>
        <Link
          href="/posts/new"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Post
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {["All", "Published", "Draft", "Scheduled", "Archived"].map((status) => (
          <button
            key={status}
            className="px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 transition-colors data-[active=true]:text-indigo-600 data-[active=true]:border-indigo-600"
            data-active={status === "All"}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Posts table */}
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
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                No posts yet.{" "}
                <Link href="/posts/new" className="text-indigo-600 hover:underline">
                  Create your first post
                </Link>
                .
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

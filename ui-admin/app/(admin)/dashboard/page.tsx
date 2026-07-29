import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back to BlogSite Admin</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Posts", value: "—", href: "/posts" },
          { label: "Published", value: "—", href: "/posts?status=Published" },
          { label: "Drafts", value: "—", href: "/posts?status=Draft" },
          { label: "Page Views (30d)", value: "—", href: "/analytics" },
        ].map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
          </Link>
        ))}
      </div>

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

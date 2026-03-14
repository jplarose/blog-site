import Link from "next/link";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Layout Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage reusable HTML/CSS templates for your blog posts
          </p>
        </div>
        <Link
          href="/templates/new"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Template
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder card */}
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-400">
          <p className="text-sm">No templates yet.</p>
          <Link
            href="/templates/new"
            className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
          >
            Create your first template →
          </Link>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Templates use <code className="bg-gray-100 px-1 rounded">{"{{title}}"}</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">{"{{content}}"}</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">{"{{category}}"}</code>, and other
        placeholder variables that are replaced at render time.
      </p>
    </div>
  );
}

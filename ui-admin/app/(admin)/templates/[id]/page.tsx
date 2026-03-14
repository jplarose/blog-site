import Link from "next/link";

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  void params;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates" className="text-sm text-gray-500 hover:text-gray-700">
          ← Templates
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center text-gray-400">
        <p>Template editor — connect to API to load template data.</p>
        <p className="mt-2 text-sm">
          See <code className="bg-gray-100 px-1 rounded">lib/api.ts</code> for the{" "}
          <code className="bg-gray-100 px-1 rounded">templatesApi.get(id)</code> helper.
        </p>
      </div>
    </div>
  );
}

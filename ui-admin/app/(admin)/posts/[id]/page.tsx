import Link from "next/link";

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  void params; // params.id will be used when wired to the API
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/posts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Posts
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Post</h1>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center text-gray-400">
        <p>Post editor — connect to API to load post data.</p>
        <p className="mt-2 text-sm">
          See <code className="bg-gray-100 px-1 rounded">lib/api.ts</code> for the{" "}
          <code className="bg-gray-100 px-1 rounded">postsApi.get(id)</code> helper.
        </p>
      </div>
    </div>
  );
}

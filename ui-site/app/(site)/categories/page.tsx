import Link from "next/link";
import type { Metadata } from "next";
import type { Category } from "@/lib/api";
import { categoriesApi } from "@/lib/api";
import PageViewRecorder from "@/components/PageViewRecorder";

export const metadata: Metadata = {
  title: "BlogSite — Categories",
  description: "Browse posts by topic.",
};

export default async function CategoriesPage() {
  let categories: Category[] = [];
  let loadFailed = false;

  try {
    categories = await categoriesApi.list();
  } catch {
    loadFailed = true;
  }

  return (
    <div className="space-y-8">
      <PageViewRecorder />
      <section>
        <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
        <p className="mt-2 text-gray-500">Browse posts by topic</p>
      </section>

      {loadFailed ? (
        <div className="rounded-xl border border-dashed border-red-300 p-12 text-center text-red-500">
          <p className="text-lg">Something went wrong loading categories.</p>
          <p className="mt-1 text-sm">Please try again later.</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No categories yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
            >
              <h2 className="font-semibold text-gray-900">{cat.name}</h2>
              {cat.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{cat.description}</p>
              )}
              <p className="mt-3 text-xs text-indigo-600 font-medium">
                {cat.postCount} post{cat.postCount !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

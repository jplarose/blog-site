import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Category, PostSummary } from "@/lib/api";
import { categoriesApi, postsApi } from "@/lib/api";
import PageViewRecorder from "@/components/PageViewRecorder";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Resolves a category by slug. `category: null, failed: false` means the
 * slug doesn't match any category (an unambiguous 404 — categories have no
 * publish-visibility rule the way posts do). `failed: true` means the API
 * call itself errored (outage), which the page renders as an error state
 * rather than a 404. Exported so this distinction is unit-testable (#41)
 * without rendering the server component.
 */
export async function loadCategory(slug: string): Promise<{ category: Category | null; failed: boolean }> {
  try {
    return { category: await categoriesApi.getBySlug(slug), failed: false };
  } catch {
    return { category: null, failed: true };
  }
}

/** Same failed-vs-empty distinction as `loadCategory`, for a category's posts. */
export async function loadCategoryPosts(
  categoryId: number
): Promise<{ posts: PostSummary[]; failed: boolean }> {
  try {
    const result = await postsApi.list({ categoryId, pageSize: 50 });
    return { posts: result.posts, failed: false };
  } catch {
    return { posts: [], failed: true };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await loadCategory(slug);

  if (!category) return { title: "Category — BlogSite" };

  return {
    title: `${category.name} — BlogSite`,
    description: category.description ?? `Posts in ${category.name}`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const { category, failed: categoryLoadFailed } = await loadCategory(slug);

  if (categoryLoadFailed) {
    return (
      <div className="rounded-xl border border-dashed border-red-300 p-12 text-center text-red-500">
        <p className="text-lg">Something went wrong loading this category.</p>
        <p className="mt-1 text-sm">Please try again later.</p>
      </div>
    );
  }

  // The API distinguishes "post exists but isn't Published" (404 on the post
  // routes) from "category doesn't exist" — categories have no such
  // visibility rule, so a missing category slug is unambiguously a 404.
  if (!category) return notFound();

  const { posts, failed: postsLoadFailed } = await loadCategoryPosts(category.id);

  return (
    <div className="space-y-10">
      <PageViewRecorder />
      <section>
        <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-gray-500">{category.description}</p>
        )}
        {!postsLoadFailed && (
          <p className="mt-1 text-sm text-gray-400">
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        )}
      </section>

      {postsLoadFailed ? (
        <div className="rounded-xl border border-dashed border-red-300 p-12 text-center text-red-500">
          <p className="text-lg">Something went wrong loading posts.</p>
          <p className="mt-1 text-sm">Please try again later.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No posts in this category yet.
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.id} className="border-b border-gray-100 pb-8">
              {post.featuredImageUrl && (
                <div className="relative w-full h-52 mb-4">
                  <Image
                    src={post.featuredImageUrl}
                    alt={post.title}
                    fill
                    className="object-cover rounded-xl"
                  />
                </div>
              )}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                {post.excerpt && (
                  <p className="text-gray-600 text-sm leading-relaxed">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                  {post.tags.length > 0 && <span>{post.tags.join(", ")}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  let category: Category | null = null;
  try {
    category = await categoriesApi.getBySlug(slug);
  } catch {
    // fall through to a generic title; the page body will show the error state
  }

  if (!category) return { title: "Category — BlogSite" };

  return {
    title: `${category.name} — BlogSite`,
    description: category.description ?? `Posts in ${category.name}`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  let category: Category | null = null;
  let categoryLoadFailed = false;
  try {
    category = await categoriesApi.getBySlug(slug);
  } catch {
    categoryLoadFailed = true;
  }

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

  let posts: PostSummary[] = [];
  let postsLoadFailed = false;
  try {
    const result = await postsApi.list({ categoryId: category.id, pageSize: 50 });
    posts = result.posts;
  } catch {
    postsLoadFailed = true;
  }

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

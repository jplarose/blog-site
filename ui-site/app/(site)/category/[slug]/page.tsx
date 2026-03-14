import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Category, PostSummary } from "@/lib/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  let category: Category | null = null;
  let posts: PostSummary[] = [];

  try {
    const [catsRes, postsRes] = await Promise.all([
      fetch(`${apiBase}/api/categories`, { next: { revalidate: 60 } }),
      fetch(`${apiBase}/api/posts?status=Published`, { next: { revalidate: 60 } }),
    ]);

    if (catsRes.ok) {
      const cats: Category[] = await catsRes.json();
      category = cats.find((c) => c.slug === slug) ?? null;
    }

    if (postsRes.ok) {
      const allPosts: PostSummary[] = await postsRes.json();
      posts = category
        ? allPosts.filter((p) => p.categoryId === category!.id)
        : [];
    }
  } catch {
    // API unavailable
  }

  if (!category) return notFound();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-gray-500">{category.description}</p>
        )}
        <p className="mt-1 text-sm text-gray-400">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
      </section>

      {posts.length === 0 ? (
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

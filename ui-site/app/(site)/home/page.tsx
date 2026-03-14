import Image from "next/image";
import Link from "next/link";
import type { PostSummary } from "@/lib/api";

export default async function HomePage() {
  let posts: PostSummary[] = [];

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/posts?status=Published`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) posts = await res.json();
  } catch {
    // API not available — render empty state
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-gray-900">Latest Posts</h1>
        <p className="mt-2 text-gray-500">Thoughts, tutorials, and ideas.</p>
      </section>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          <p className="text-lg">No posts published yet.</p>
          <p className="mt-1 text-sm">Check back soon!</p>
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
                {post.categoryName && (
                  <Link
                    href={`/category/${post.categoryName.toLowerCase()}`}
                    className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
                  >
                    {post.categoryName}
                  </Link>
                )}
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
                  {post.tags.length > 0 && (
                    <span>{post.tags.join(", ")}</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

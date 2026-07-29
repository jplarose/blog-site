import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Post, LayoutTemplate } from "@/lib/api";
import { renderTemplate } from "@/lib/render-template";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  let post: Post | null = null;
  try {
    const res = await fetch(`${apiBase}/api/posts/slug/${slug}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return notFound();
    if (res.ok) post = await res.json();
  } catch {
    // API unavailable
  }

  if (!post) return notFound();

  // Load template (post-level or category-default)
  let template: LayoutTemplate | null = null;
  if (post.templateId) {
    try {
      const res = await fetch(`${apiBase}/api/layouttemplates/${post.templateId}`, {
        next: { revalidate: 300 },
      });
      if (res.ok) template = await res.json();
    } catch {
      // fall through to default rendering
    }
  }

  return (
    <article>
      {template ? (
        <>
          <style dangerouslySetInnerHTML={{ __html: template.cssStyles }} />
          <div
            dangerouslySetInnerHTML={{
              __html: renderTemplate(template.htmlStructure, post, post.publishedAt),
            }}
          />
        </>
      ) : (
        /* Default fallback rendering */
        <div className="prose prose-lg max-w-none">
          {post.featuredImageUrl && (
            <div className="relative w-full h-64 mb-6 not-prose">
              <Image
                src={post.featuredImageUrl}
                alt={post.title}
                fill
                className="object-cover rounded-xl"
              />
            </div>
          )}
          <header className="mb-8">
            {post.categoryName && (
              <Link
                href={`/category/${post.categoryName.toLowerCase()}`}
                className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline not-prose"
              >
                {post.categoryName}
              </Link>
            )}
            <h1 className="text-4xl font-bold mt-2">{post.title}</h1>
            <div className="flex gap-4 text-sm text-gray-400 mt-3 not-prose">
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
          </header>
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
      )}
    </article>
  );
}

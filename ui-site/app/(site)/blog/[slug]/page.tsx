import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Category, Post, LayoutTemplate } from "@/lib/api";
import { categoriesApi, postsApi, templatesApi } from "@/lib/api";
import { renderTemplate } from "@/lib/render-template";
import { buildPostMetadata } from "@/lib/metadata";
import { resolveCategorySlug } from "@/lib/category-link";
import PageViewRecorder from "@/components/PageViewRecorder";

interface Props {
  params: Promise<{ slug: string }>;
}

async function loadPost(slug: string): Promise<Post | null> {
  try {
    return await postsApi.getBySlug(slug);
  } catch {
    // A 404 means the post doesn't exist, or exists but isn't Published to
    // this (anonymous) caller (#33) — either way it's a public 404. Any
    // other error (API outage, network failure) also has no meaningful post
    // to render, so it 404s too rather than crashing the route.
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  return buildPostMetadata(post);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await loadPost(slug);

  if (!post) return notFound();

  // Load the post's fixed-catalog template (#39). Falls through to the
  // default rendering below if the template can't be loaded.
  let template: LayoutTemplate | null = null;
  if (post.templateId) {
    try {
      template = await templatesApi.get(post.templateId);
    } catch {
      // fall through to default rendering
    }
  }

  // Only the fallback rendering below links to the category — resolve its
  // real slug (not the templated render path, which doesn't link at all).
  let categorySlug: string | null = null;
  if (!template && post.categoryId !== undefined) {
    try {
      const categories: Category[] = await categoriesApi.list();
      categorySlug = resolveCategorySlug(categories, post.categoryId);
    } catch {
      // categorySlug stays null — renders as plain text below
    }
  }

  return (
    <article>
      <PageViewRecorder postId={post.id} />
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
            {post.categoryName && categorySlug && (
              <Link
                href={`/category/${categorySlug}`}
                className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline not-prose"
              >
                {post.categoryName}
              </Link>
            )}
            {post.categoryName && !categorySlug && (
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 not-prose">
                {post.categoryName}
              </span>
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

import type { Metadata } from "next";
import type { Post } from "@/lib/api";

const ALLOWED_IMAGE_SCHEMES = new Set(["http:", "https:"]);

/**
 * Restricts a would-be `og:image` URL to absolute `http:`/`https:` URLs.
 * Rejects everything else — relative paths (no useful base to resolve
 * against for an OG tag), `javascript:`/`data:`/`vbscript:`, and malformed
 * strings. Mirrors the scheme-allowlist reasoning in
 * `render-template.ts`'s `sanitizeFeaturedImageUrl`, applied independently
 * here since page metadata never goes through the renderer.
 */
export function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ALLOWED_IMAGE_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Builds `generateMetadata` output for a blog post detail page. `post` is
 * `null` when the post couldn't be resolved (not found, or not Published to
 * an anonymous caller — see #33) — the page itself still calls `notFound()`
 * separately; this only decides what metadata to emit either way.
 */
export function buildPostMetadata(post: Post | null): Metadata {
  if (!post) return { title: "Post not found — BlogSite" };

  const description = post.excerpt ?? undefined;
  const ogImage = isValidHttpUrl(post.featuredImageUrl) ? [post.featuredImageUrl!] : undefined;

  return {
    title: `${post.title} — BlogSite`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      images: ogImage,
    },
  };
}

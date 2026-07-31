import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/api";
import { buildPostMetadata, isValidHttpUrl } from "@/lib/metadata";

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    title: "Hello World",
    slug: "hello-world",
    content: "<p>Body</p>",
    excerpt: "A short summary",
    featuredImageUrl: undefined,
    status: "Published",
    publishedAt: undefined,
    categoryId: undefined,
    categoryName: undefined,
    templateId: 1,
    templateKey: "article",
    templateName: "Article",
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isValidHttpUrl", () => {
  it("accepts absolute http URLs", () => {
    expect(isValidHttpUrl("http://example.com/image.png")).toBe(true);
  });

  it("accepts absolute https URLs", () => {
    expect(isValidHttpUrl("https://example.com/image.png")).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(isValidHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects relative paths", () => {
    expect(isValidHttpUrl("/images/foo.png")).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isValidHttpUrl("not a url")).toBe(false);
  });

  it("rejects undefined and empty string", () => {
    expect(isValidHttpUrl(undefined)).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});

describe("buildPostMetadata", () => {
  it("returns a not-found title when post is null", () => {
    const metadata = buildPostMetadata(null);
    expect(metadata).toEqual({ title: "Post not found — BlogSite" });
  });

  it("sets title and description from the post's excerpt", () => {
    const metadata = buildPostMetadata(post({ title: "My Post", excerpt: "The summary" }));
    expect(metadata.title).toBe("My Post — BlogSite");
    expect(metadata.description).toBe("The summary");
  });

  it("falls back to an undefined description when there is no excerpt", () => {
    const metadata = buildPostMetadata(post({ excerpt: undefined }));
    expect(metadata.description).toBeUndefined();
  });

  it("includes the featured image in openGraph.images when it's a valid http(s) URL", () => {
    const metadata = buildPostMetadata(post({ featuredImageUrl: "https://example.com/img.png" }));
    expect(metadata.openGraph?.images).toEqual(["https://example.com/img.png"]);
  });

  it("omits openGraph.images when the featured image URL is invalid", () => {
    const metadata = buildPostMetadata(post({ featuredImageUrl: "javascript:alert(1)" }));
    expect(metadata.openGraph?.images).toBeUndefined();
  });

  it("omits openGraph.images when there is no featured image", () => {
    const metadata = buildPostMetadata(post({ featuredImageUrl: undefined }));
    expect(metadata.openGraph?.images).toBeUndefined();
  });
});

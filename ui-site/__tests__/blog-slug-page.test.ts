import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiNotFoundError, postsApi, type Post } from "@/lib/api";
import { loadPost } from "@/app/(site)/blog/[slug]/page";

afterEach(() => {
  vi.restoreAllMocks();
});

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

// The blog/[slug] page calls `notFound()` whenever `loadPost` returns null,
// so both gaps below collapse to the same page-level behavior (a public
// 404) by design — see the comment on `loadPost` itself. These tests prove
// that collapsing happens at the data layer for both cases.
describe("loadPost (app/(site)/blog/[slug]/page)", () => {
  it("returns the post when the API resolves it", async () => {
    const resolved = post({ title: "Found" });
    vi.spyOn(postsApi, "getBySlug").mockResolvedValue(resolved);

    await expect(loadPost("hello-world")).resolves.toEqual(resolved);
  });

  it("returns null on ApiNotFoundError (post missing, or not Published to an anonymous caller — #33)", async () => {
    vi.spyOn(postsApi, "getBySlug").mockRejectedValue(new ApiNotFoundError("/api/posts/slug/missing"));

    await expect(loadPost("missing")).resolves.toBeNull();
  });

  it("returns null on a generic API failure (outage), not just on 404", async () => {
    vi.spyOn(postsApi, "getBySlug").mockRejectedValue(new Error("API error 500 for /api/posts/slug/x"));

    await expect(loadPost("x")).resolves.toBeNull();
  });
});

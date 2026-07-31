import { afterEach, describe, expect, it, vi } from "vitest";

import { categoriesApi, postsApi, type Category, type PostSummary } from "@/lib/api";
import { loadCategory, loadCategoryPosts } from "@/app/(site)/category/[slug]/page";

afterEach(() => {
  vi.restoreAllMocks();
});

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: "News",
    slug: "news",
    description: undefined,
    postCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// The category/[slug] page renders different UI for "category doesn't
// exist" (404) vs "the API call itself failed" (error banner) — unlike the
// blog/[slug] page, these two cases must stay distinguishable at the data
// layer, so `loadCategory`/`loadCategoryPosts` return a `failed` flag
// instead of collapsing both to null.
describe("loadCategory (app/(site)/category/[slug]/page)", () => {
  it("returns the category, not failed, when the API resolves a match", async () => {
    const resolved = category({ slug: "tutorials" });
    vi.spyOn(categoriesApi, "getBySlug").mockResolvedValue(resolved);

    await expect(loadCategory("tutorials")).resolves.toEqual({ category: resolved, failed: false });
  });

  it("returns category: null, failed: false for an unknown slug (404, not an error)", async () => {
    vi.spyOn(categoriesApi, "getBySlug").mockResolvedValue(null);

    await expect(loadCategory("missing")).resolves.toEqual({ category: null, failed: false });
  });

  it("returns category: null, failed: true when the API call throws (outage)", async () => {
    vi.spyOn(categoriesApi, "getBySlug").mockRejectedValue(new Error("API error 500"));

    await expect(loadCategory("news")).resolves.toEqual({ category: null, failed: true });
  });
});

describe("loadCategoryPosts (app/(site)/category/[slug]/page)", () => {
  it("returns the category's posts, not failed, on success", async () => {
    const posts: PostSummary[] = [
      { id: 1, title: "A", slug: "a", status: "Published", tags: [], createdAt: "", updatedAt: "" },
    ];
    vi.spyOn(postsApi, "list").mockResolvedValue({ posts, totalCount: 1 });

    await expect(loadCategoryPosts(1)).resolves.toEqual({ posts, failed: false });
  });

  it("returns an empty list and failed: true when the API call throws (outage)", async () => {
    vi.spyOn(postsApi, "list").mockRejectedValue(new Error("API error 500"));

    await expect(loadCategoryPosts(1)).resolves.toEqual({ posts: [], failed: true });
  });
});

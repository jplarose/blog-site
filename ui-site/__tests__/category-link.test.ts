import { describe, expect, it } from "vitest";

import type { Category } from "@/lib/api";
import { resolveCategorySlug } from "@/lib/category-link";

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

describe("resolveCategorySlug", () => {
  it("returns the slug of the category matching by id", () => {
    const categories = [category({ id: 1, slug: "news" }), category({ id: 2, slug: "dev-tutorials" })];
    expect(resolveCategorySlug(categories, 2)).toBe("dev-tutorials");
  });

  it("matches even when the category name differs from its slug", () => {
    const categories = [category({ id: 5, name: "Dev & Tutorials!", slug: "dev-and-tutorials" })];
    expect(resolveCategorySlug(categories, 5)).toBe("dev-and-tutorials");
  });

  it("returns null when categoryId is undefined", () => {
    const categories = [category({ id: 1 })];
    expect(resolveCategorySlug(categories, undefined)).toBeNull();
  });

  it("returns null when no category matches the id", () => {
    const categories = [category({ id: 1 })];
    expect(resolveCategorySlug(categories, 999)).toBeNull();
  });

  it("returns null against an empty category list", () => {
    expect(resolveCategorySlug([], 1)).toBeNull();
  });
});

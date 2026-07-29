import type { Category } from "@/lib/api";

/**
 * Resolves the real slug for a post's category, matching by id against the
 * full category list.
 *
 * Posts only carry `categoryId`/`categoryName` (no `categorySlug` — the API
 * doesn't expose one), so `categoryName.toLowerCase()` is not a safe stand-in
 * for a slug: it breaks for any category whose name differs from its slug
 * (spaces, punctuation, casing, renames). Callers should link to
 * `/category/{slug}` only when this returns non-null, and render plain text
 * otherwise rather than a link that 404s.
 */
export function resolveCategorySlug(categories: Category[], categoryId: number | undefined): string | null {
  if (categoryId === undefined) return null;
  return categories.find((category) => category.id === categoryId)?.slug ?? null;
}

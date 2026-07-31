/**
 * Suggests a URL-safe slug from a display name (lowercase, hyphenated,
 * alphanumerics only). Mirrors the API's `SlugValidator.IsUrlSafe` rule so
 * the suggestion always passes server-side validation; the field stays
 * editable so this is only a starting point, not an enforced transform.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Client-side renderer for the fixed catalog templates' mustache-style
 * markup (see sql/seeds/002_catalog_templates.sql for the token contract).
 * Used to preview a post's current field values inside a template without
 * calling the API. The API remains the source of truth for the saved
 * post's rendered output; this is a preview-only approximation.
 */

export interface TemplateTokenValues {
  title: string;
  /** Rich post body HTML. Rendered verbatim (not escaped) — the API sanitizes it at save. */
  content: string;
  excerpt: string;
  featuredImage: string;
  publishedAt: string;
  category: string;
  tags: string;
}

/** Token keys whose values are rendered as raw HTML rather than escaped text. */
const RAW_HTML_KEYS = new Set<keyof TemplateTokenValues>(["content"]);

const SECTION_PATTERN = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;
const TOKEN_PATTERN = /{{(\w+)}}/g;

/**
 * Renders an `html_structure` template string against a set of post field
 * values, resolving `{{#key}}...{{/key}}` conditional sections and
 * `{{key}}` token substitutions.
 */
export function renderTemplateHtml(htmlStructure: string, values: TemplateTokenValues): string {
  const withSectionsResolved = htmlStructure.replace(SECTION_PATTERN, (_match, key, inner: string) =>
    isTruthy(values, key) ? inner : "",
  );

  return withSectionsResolved.replace(TOKEN_PATTERN, (_match, key) => resolveToken(values, key));
}

function isTruthy(values: TemplateTokenValues, key: string): boolean {
  const value = getTokenValue(values, key);
  return value.trim().length > 0;
}

function resolveToken(values: TemplateTokenValues, key: string): string {
  const value = getTokenValue(values, key);
  return RAW_HTML_KEYS.has(key as keyof TemplateTokenValues) ? value : escapeHtml(value);
}

function getTokenValue(values: TemplateTokenValues, key: string): string {
  return key in values ? values[key as keyof TemplateTokenValues] : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

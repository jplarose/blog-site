import type { Post } from "@/lib/api";

/**
 * Renders a fixed-catalog template's `html_structure` (see
 * sql/seeds/002_catalog_templates.sql) against a post's field values.
 *
 * Catalog HTML/CSS is trusted — it is app-managed and seeded, never
 * user-editable. Post field values are author-controlled and are escaped
 * before insertion, except `content`, which the API sanitizes as rich HTML
 * at save time (issue #34) and which templates place verbatim.
 */

/** Token keys whose values are inserted as raw HTML rather than escaped text. */
const RAW_HTML_TOKEN_KEYS = new Set(["content"]);

const SECTION_PATTERN = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

const ALLOWED_FEATURED_IMAGE_SCHEMES = new Set(["http", "https"]);

interface TokenValues {
  title: string;
  content: string;
  excerpt: string;
  /** Sanitized (scheme-checked) URL, not yet HTML/attribute-escaped. */
  featuredImage: string;
  publishedAt: string;
  category: string;
  tags: string;
}

/**
 * Render a catalog template's `htmlStructure` by substituting the standard
 * template token set: `{{title}}`, `{{content}}`, `{{excerpt}}`,
 * `{{publishedAt}}`, `{{category}}`, `{{tags}}`, `{{featuredImage}}`, and the
 * `{{#featuredImage}}...{{/featuredImage}}` conditional section.
 *
 * Missing optional post values (excerpt, featuredImage, category, tags,
 * publishedAt) render as empty text rather than failing.
 */
export function renderTemplate(htmlStructure: string, post: Post, publishedAt?: string): string {
  const tokens = buildTokenValues(post, publishedAt);

  const withSectionsResolved = htmlStructure.replace(
    SECTION_PATTERN,
    (_match, key: string, inner: string) => (isSectionTruthy(tokens, key) ? inner : "")
  );

  return withSectionsResolved.replace(TOKEN_PATTERN, (_match, key: string) => resolveToken(tokens, key));
}

function buildTokenValues(post: Post, publishedAt?: string): TokenValues {
  return {
    title: post.title,
    content: post.content,
    excerpt: post.excerpt ?? "",
    featuredImage: sanitizeFeaturedImageUrl(post.featuredImageUrl ?? ""),
    publishedAt: formatPublishedAt(publishedAt),
    category: post.categoryName ?? "",
    tags: post.tags.map((tag) => tag).join(", "),
  };
}

function isSectionTruthy(tokens: TokenValues, key: string): boolean {
  return getTokenValue(tokens, key).trim().length > 0;
}

function resolveToken(tokens: TokenValues, key: string): string {
  const value = getTokenValue(tokens, key);
  return RAW_HTML_TOKEN_KEYS.has(key) ? value : escapeHtml(value);
}

function getTokenValue(tokens: TokenValues, key: string): string {
  return key in tokens ? tokens[key as keyof TokenValues] : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Restrict `{{featuredImage}}` to relative URLs and http/https absolute
 * URLs. Anything else (`javascript:`, `data:`, `vbscript:`, etc.) is
 * dropped before it can reach a `src` attribute. The returned value is
 * still HTML/attribute-escaped by `resolveToken` before insertion.
 *
 * ASCII control characters are stripped first, since browsers ignore them
 * when parsing a URL scheme — e.g. "java\tscript:" is parsed by browsers as
 * "javascript:", a classic scheme-filter bypass.
 */
function sanitizeFeaturedImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/[\t\n\r]/g, "");
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized);
  if (!schemeMatch) return normalized; // no scheme => relative URL, allowed

  return ALLOWED_FEATURED_IMAGE_SCHEMES.has(schemeMatch[1].toLowerCase()) ? normalized : "";
}

/**
 * Format a published-date token deterministically so server and client
 * render identical markup regardless of the runtime's default locale or
 * timezone (avoids hydration drift from `toLocaleDateString()`).
 */
function formatPublishedAt(publishedAt?: string): string {
  if (!publishedAt) return "";

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

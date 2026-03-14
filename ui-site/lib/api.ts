export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImageUrl?: string;
  status: string;
  publishedAt?: string;
  categoryId?: number;
  categoryName?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImageUrl?: string;
  status: string;
  publishedAt?: string;
  categoryId?: number;
  categoryName?: string;
  templateId?: number;
  templateName?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  defaultTemplateId?: number;
  defaultTemplateName?: string;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutTemplate {
  id: number;
  name: string;
  description: string;
  htmlStructure: string;
  cssStyles: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const postsApi = {
  listPublished: (categorySlug?: string) => {
    const qs = categorySlug
      ? `?status=Published&tag=` // extend with category filter as needed
      : "?status=Published";
    return apiFetch<PostSummary[]>(`/api/posts${qs}`);
  },
  getBySlug: (slug: string) =>
    apiFetch<Post>(`/api/posts/slug/${slug}`),
};

export const categoriesApi = {
  list: () => apiFetch<Category[]>("/api/categories"),
  getBySlug: (slug: string) =>
    apiFetch<Category[]>("/api/categories").then(
      (cats) => cats.find((c) => c.slug === slug) ?? null
    ),
};

export const templatesApi = {
  get: (id: number) => apiFetch<LayoutTemplate>(`/api/layouttemplates/${id}`),
};

export function recordPageView(postId: number | null, path: string, referrer?: string) {
  fetch(`${API_BASE_URL}/api/analytics/pageview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, path, referrer }),
  }).catch(() => {
    // fire-and-forget — analytics failures must not break the page
  });
}

/**
 * Render a template by replacing {{variable}} placeholders with post data.
 */
export function renderTemplate(
  htmlStructure: string,
  post: Post,
  publishedAt?: string
): string {
  return htmlStructure
    .replace(/\{\{title\}\}/g, escapeHtml(post.title))
    .replace(/\{\{content\}\}/g, post.content) // content is already HTML / markdown
    .replace(/\{\{excerpt\}\}/g, escapeHtml(post.excerpt ?? ""))
    .replace(/\{\{publishedAt\}\}/g, publishedAt ? new Date(publishedAt).toLocaleDateString() : "")
    .replace(/\{\{category\}\}/g, escapeHtml(post.categoryName ?? ""))
    .replace(/\{\{tags\}\}/g, post.tags.map(escapeHtml).join(", "))
    .replace(/\{\{featuredImage\}\}/g, post.featuredImageUrl ?? "")
    .replace(/\{\{#featuredImage\}\}[\s\S]*?\{\{\/featuredImage\}\}/g, (match) =>
      post.featuredImageUrl
        ? match.replace(/\{\{#featuredImage\}\}/, "").replace(/\{\{\/featuredImage\}\}/, "")
        : ""
    );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

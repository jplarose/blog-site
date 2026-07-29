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
  templateId?: number;
  templateKey?: string;
  templateName?: string;
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
  templateKey?: string;
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
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

/** List view of a fixed catalog template, as returned by `GET /api/layouttemplates`. */
export interface LayoutTemplateSummary {
  id: number;
  templateKey: string;
  name: string;
  description: string;
}

/** Full catalog template, as returned by `GET /api/layouttemplates/{id}`. */
export interface LayoutTemplate extends LayoutTemplateSummary {
  htmlStructure: string;
  cssStyles: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const postsApi = {
  // categorySlug is accepted but not yet applied as a server-side filter;
  // wiring it up is #40's concern. This intentionally drops the previous
  // dead `&tag=` query fragment, which never filtered by category.
  listPublished: (categorySlug?: string) => {
    void categorySlug;
    return apiFetch<PostSummary[]>("/api/posts?status=Published");
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

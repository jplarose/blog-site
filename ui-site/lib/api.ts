export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/**
 * ISR revalidation intervals (seconds) for each fetch this client makes.
 * Documented in ui-site/README.md — keep the two in sync.
 */
export const REVALIDATE_SECONDS = {
  postList: 60,
  post: 60,
  categories: 60,
  template: 300,
} as const;

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

/** Filters for `GET /api/posts`, matching the API's query parameters. */
export interface PostListParams {
  categoryId?: number;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export interface PostListResult {
  posts: PostSummary[];
  /** From the `X-Total-Count` response header. */
  totalCount: number;
}

/**
 * Thrown when the API responds 404. Anonymous callers get 404 (not 403) for
 * any non-Published post, by design (#33) — callers use this to distinguish
 * "not found" from a genuine outage without inspecting `Error` messages.
 */
export class ApiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = "ApiNotFoundError";
  }
}

export function isNotFoundError(error: unknown): error is ApiNotFoundError {
  return error instanceof ApiNotFoundError;
}

async function apiFetch<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate },
  });
  if (res.status === 404) throw new ApiNotFoundError(path);
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  return res.json();
}

async function apiFetchList<T>(
  path: string,
  revalidate: number
): Promise<{ data: T; totalCount: number }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  const totalCount = Number(res.headers.get("X-Total-Count") ?? "0");
  const data = (await res.json()) as T;
  return { data, totalCount: Number.isNaN(totalCount) ? 0 : totalCount };
}

function buildPostListQuery(params: PostListParams): string {
  const search = new URLSearchParams();
  if (params.categoryId !== undefined) search.set("categoryId", String(params.categoryId));
  if (params.tag) search.set("tag", params.tag);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.pageSize !== undefined) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const postsApi = {
  /**
   * Lists posts. The API forces anonymous callers to Published-only
   * server-side (#33), so this client never sends a `status` filter — the
   * public site has no need for it and must not rely on one.
   */
  list: async (params: PostListParams = {}): Promise<PostListResult> => {
    const { data, totalCount } = await apiFetchList<PostSummary[]>(
      `/api/posts${buildPostListQuery(params)}`,
      REVALIDATE_SECONDS.postList
    );
    return { posts: data, totalCount };
  },
  getBySlug: (slug: string) =>
    apiFetch<Post>(`/api/posts/slug/${slug}`, REVALIDATE_SECONDS.post),
};

export const categoriesApi = {
  list: () => apiFetch<Category[]>("/api/categories", REVALIDATE_SECONDS.categories),
  getBySlug: async (slug: string): Promise<Category | null> => {
    const categories = await categoriesApi.list();
    return categories.find((c) => c.slug === slug) ?? null;
  },
};

export const templatesApi = {
  get: (id: number) =>
    apiFetch<LayoutTemplate>(`/api/layouttemplates/${id}`, REVALIDATE_SECONDS.template),
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

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export type PostStatus = "Draft" | "Scheduled" | "Published" | "Archived";

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImageUrl?: string;
  status: PostStatus;
  publishedAt?: string;
  scheduledAt?: string;
  categoryId?: number;
  categoryName?: string;
  templateId?: number;
  templateName?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImageUrl?: string;
  status: PostStatus;
  publishedAt?: string;
  scheduledAt?: string;
  categoryId?: number;
  categoryName?: string;
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

export interface Tag {
  id: number;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string;
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

export interface AnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  topPosts: { postId: number; title: string; slug: string; viewCount: number }[];
  dailyViews: { date: string; viewCount: number }[];
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Posts ----
export const postsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<PostSummary[]>(`/api/posts${qs}`);
  },
  get: (id: number) => apiFetch<Post>(`/api/posts/${id}`),
  create: (data: unknown) =>
    apiFetch<Post>("/api/posts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: unknown) =>
    apiFetch<Post>(`/api/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/posts/${id}`, { method: "DELETE" }),
  publish: (id: number) =>
    apiFetch<Post>(`/api/posts/${id}/publish`, { method: "POST" }),
};

// ---- Categories ----
export const categoriesApi = {
  list: () => apiFetch<Category[]>("/api/categories"),
  get: (id: number) => apiFetch<Category>(`/api/categories/${id}`),
  create: (data: unknown) =>
    apiFetch<Category>("/api/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: unknown) =>
    apiFetch<Category>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/categories/${id}`, { method: "DELETE" }),
};

// ---- Tags ----
export const tagsApi = {
  list: () => apiFetch<Tag[]>("/api/tags"),
  get: (id: number) => apiFetch<Tag>(`/api/tags/${id}`),
  create: (data: unknown) =>
    apiFetch<Tag>("/api/tags", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: unknown) =>
    apiFetch<Tag>(`/api/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/tags/${id}`, { method: "DELETE" }),
};

// ---- Templates ----
export const templatesApi = {
  list: () => apiFetch<LayoutTemplate[]>("/api/layouttemplates"),
  get: (id: number) => apiFetch<LayoutTemplate>(`/api/layouttemplates/${id}`),
  create: (data: unknown) =>
    apiFetch<LayoutTemplate>("/api/layouttemplates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: unknown) =>
    apiFetch<LayoutTemplate>(`/api/layouttemplates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/layouttemplates/${id}`, { method: "DELETE" }),
};

// ---- Analytics ----
export const analyticsApi = {
  summary: (days = 30) =>
    apiFetch<AnalyticsSummary>(`/api/analytics/summary?days=${days}`),
  recordPageView: (data: unknown) =>
    apiFetch<void>("/api/analytics/pageview", { method: "POST", body: JSON.stringify(data) }),
};

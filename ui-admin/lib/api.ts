import type { LayoutTemplate, PostTemplateContent, TemplateSummary } from "@/lib/template-schema";

export const API_BASE_URL = "";
const SERVER_APP_BASE_URL =
  process.env.APP_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export type PostStatus = "Draft" | "Scheduled" | "Published" | "Archived";

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  templateContent?: PostTemplateContent;
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

export interface Tag {
  id: number;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string;
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

export interface MediaUpload {
  url: string;
}

/** Distinguishable error thrown by `apiFetch` so callers can tell auth failures apart. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const requestUrl =
    typeof window === "undefined"
      ? new URL(
          path,
          SERVER_APP_BASE_URL.endsWith("/")
            ? SERVER_APP_BASE_URL
            : `${SERVER_APP_BASE_URL}/`,
        ).toString()
      : `${API_BASE_URL}${path}`;

  const res = await fetch(requestUrl, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // The proxy already retried once with a refreshed token; a 401 here means
      // the session is gone. Send the browser back to the login page.
      window.location.assign("/login");
      throw new ApiError(401, "Unauthorized");
    }
    throw new ApiError(res.status, `API error ${res.status}: ${await res.text()}`);
  }

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

// ---- Templates (read-only catalog; see issue #30) ----
export const templatesApi = {
  list: () => apiFetch<TemplateSummary[]>("/api/layouttemplates"),
  get: (id: number) => apiFetch<LayoutTemplate>(`/api/layouttemplates/${id}`),
};

// ---- Analytics ----
export const analyticsApi = {
  summary: (days = 30) =>
    apiFetch<AnalyticsSummary>(`/api/analytics/summary?days=${days}`),
  recordPageView: (data: unknown) =>
    apiFetch<void>("/api/analytics/pageview", { method: "POST", body: JSON.stringify(data) }),
};

// ---- Media ----
export const mediaApi = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/media/images", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Image upload failed." }));
      throw new Error(error.message ?? "Image upload failed.");
    }

    return response.json() as Promise<MediaUpload>;
  },
};

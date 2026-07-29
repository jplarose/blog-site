import { afterEach, describe, expect, it, vi } from "vitest";

import {
  API_BASE_URL,
  ApiNotFoundError,
  categoriesApi,
  isNotFoundError,
  postsApi,
  recordPageView,
  templatesApi,
} from "@/lib/api";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postsApi.list", () => {
  it("requests /api/posts with no query string when no params are given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([], { headers: { "X-Total-Count": "0" } }));
    vi.stubGlobal("fetch", fetchMock);

    await postsApi.list();

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/posts`, expect.any(Object));
  });

  it("builds categoryId, tag, page, and pageSize into the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([], { headers: { "X-Total-Count": "0" } }));
    vi.stubGlobal("fetch", fetchMock);

    await postsApi.list({ categoryId: 7, tag: "news", page: 2, pageSize: 10 });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`${API_BASE_URL}/api/posts?`);
    expect(calledUrl).toContain("categoryId=7");
    expect(calledUrl).toContain("tag=news");
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("pageSize=10");
  });

  it("never sends a status query parameter (server forces Published for anonymous callers)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([], { headers: { "X-Total-Count": "0" } }));
    vi.stubGlobal("fetch", fetchMock);

    await postsApi.list({ categoryId: 1 });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("status=");
  });

  it("reads totalCount from the X-Total-Count header", async () => {
    const posts = [{ id: 1 }];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(posts, { headers: { "X-Total-Count": "42" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postsApi.list();

    expect(result.totalCount).toBe(42);
    expect(result.posts).toEqual(posts);
  });

  it("defaults totalCount to 0 when the header is missing or malformed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postsApi.list();

    expect(result.totalCount).toBe(0);
  });

  it("throws on a non-OK, non-404 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postsApi.list()).rejects.toThrow(/API error 500/);
  });
});

describe("postsApi.getBySlug", () => {
  it("fetches the slug detail route", async () => {
    const post = { id: 1, slug: "hello" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(post));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postsApi.getBySlug("hello");

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/posts/slug/hello`, expect.any(Object));
    expect(result).toEqual(post);
  });

  it("throws ApiNotFoundError on a 404 (non-Published post, anonymous caller)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postsApi.getBySlug("missing")).rejects.toBeInstanceOf(ApiNotFoundError);
  });

  it("is distinguishable via isNotFoundError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await postsApi.getBySlug("missing");
      expect.unreachable();
    } catch (error) {
      expect(isNotFoundError(error)).toBe(true);
    }
  });
});

describe("categoriesApi.getBySlug", () => {
  it("resolves the category matching the slug from the full list", async () => {
    const categories = [
      { id: 1, slug: "news" },
      { id: 2, slug: "tutorials" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(categories));
    vi.stubGlobal("fetch", fetchMock);

    const result = await categoriesApi.getBySlug("tutorials");

    expect(result).toEqual(categories[1]);
  });

  it("returns null when no category matches the slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 1, slug: "news" }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await categoriesApi.getBySlug("missing");

    expect(result).toBeNull();
  });
});

describe("templatesApi.get", () => {
  it("fetches a template by id", async () => {
    const template = { id: 3, templateKey: "article" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(template));
    vi.stubGlobal("fetch", fetchMock);

    const result = await templatesApi.get(3);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/layouttemplates/3`, expect.any(Object));
    expect(result).toEqual(template);
  });

  it("throws ApiNotFoundError on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(templatesApi.get(999)).rejects.toBeInstanceOf(ApiNotFoundError);
  });
});

describe("recordPageView", () => {
  it("posts to the analytics endpoint with postId, path, and referrer", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    recordPageView(5, "/blog/hello", "https://example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/analytics/pageview`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ postId: 5, path: "/blog/hello", referrer: "https://example.com" }),
      })
    );
  });

  it("swallows fetch failures (fire-and-forget)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    expect(() => recordPageView(null, "/home")).not.toThrow();
  });
});

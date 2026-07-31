import { afterEach, describe, expect, it, vi } from "vitest";

import { postsApi } from "@/lib/api";

describe("postsApi.list", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves items and total parsed from the X-Total-Count header", async () => {
    const items = [{ id: 1 }, { id: 2 }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(items), {
        status: 200,
        headers: { "content-type": "application/json", "X-Total-Count": "42" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await postsApi.list({ page: "1", pageSize: "20" });

    expect(result).toEqual({ items, total: 42 });
    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain("/api/posts?");
    expect(requestedUrl).toContain("page=1");
    expect(requestedUrl).toContain("pageSize=20");
  });

  it("falls back to the item count when X-Total-Count is missing", async () => {
    const items = [{ id: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(items), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await postsApi.list();

    expect(result).toEqual({ items, total: 1 });
  });
});

describe("postsApi lifecycle actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("schedule() posts scheduledAt as JSON to the schedule endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 5, status: "Scheduled" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await postsApi.schedule(5, "2027-01-01T00:00:00.000-05:00");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/posts/5/schedule");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      scheduledAt: "2027-01-01T00:00:00.000-05:00",
    });
  });

  it("archive() posts to the archive endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 5, status: "Archived" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await postsApi.archive(5);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/posts/5/archive");
    expect(init.method).toBe("POST");
  });

  it("schedule() surfaces the server's 400 message for a past scheduledAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("scheduledAt must be strictly in the future", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postsApi.schedule(5, "2000-01-01T00:00:00.000Z")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("schedule() surfaces a 409 for posts that cannot be scheduled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Only Draft or Scheduled posts can be scheduled", { status: 409 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postsApi.schedule(5, "2027-01-01T00:00:00.000Z")).rejects.toMatchObject({
      status: 409,
    });
  });
});

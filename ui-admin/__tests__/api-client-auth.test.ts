import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postsApi } from "@/lib/api";

describe("apiFetch client-side 401 handling", () => {
  const originalLocation = window.location;
  const assignMock = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: assignMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    assignMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("redirects to /login and throws a distinguishable error on a 401 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postsApi.list()).rejects.toMatchObject({ status: 401 });
    expect(assignMock).toHaveBeenCalledWith("/login");
  });

  it("does not redirect on a non-401 error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postsApi.list()).rejects.toThrow();
    expect(assignMock).not.toHaveBeenCalled();
  });
});

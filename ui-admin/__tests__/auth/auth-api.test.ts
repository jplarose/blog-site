import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function importFreshAuthApi() {
  vi.resetModules();
  return import("@/lib/auth/auth-api");
}

describe("auth-api client", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws a clear error when AUTH_API_BASE_URL is unset, only when a function is called (not at import time)", async () => {
    delete process.env.AUTH_API_BASE_URL;
    process.env.AUTH_API_KEY = "fake-key";

    const authApi = await importFreshAuthApi();

    await expect(authApi.loginInternal("user", "pass")).rejects.toThrow(
      /AUTH_API_BASE_URL/,
    );
  });

  it("throws a clear error when AUTH_API_KEY is unset, only when a function is called", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:5001";
    delete process.env.AUTH_API_KEY;

    const authApi = await importFreshAuthApi();

    await expect(authApi.loginInternal("user", "pass")).rejects.toThrow(
      /AUTH_API_KEY/,
    );
  });

  it("sends the X-Api-Key header and JSON body to login-internal, and returns the tokens on success", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:5001";
    process.env.AUTH_API_KEY = "b64-client-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jwtToken: "jwt",
          jwtExpiresSeconds: 900,
          refreshToken: "refresh",
          refreshExpiresSeconds: 1000,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const authApi = await importFreshAuthApi();
    const result = await authApi.loginInternal("someone", "secret");

    expect(result).toEqual({
      ok: true,
      data: {
        jwtToken: "jwt",
        jwtExpiresSeconds: 900,
        refreshToken: "refresh",
        refreshExpiresSeconds: 1000,
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:5001/Auth/login-internal");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(
      "b64-client-key",
    );
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body as string)).toEqual({
      identifier: "someone",
      password: "secret",
    });
  });

  it("distinguishes 401 from other failures on login-internal", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:5001";
    process.env.AUTH_API_KEY = "b64-client-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const authApi = await importFreshAuthApi();

    const unauthorized = await authApi.loginInternal("someone", "wrong");
    expect(unauthorized).toEqual({ ok: false, status: 401, unauthorized: true });

    const serverError = await authApi.loginInternal("someone", "wrong");
    expect(serverError).toEqual({ ok: false, status: 500, unauthorized: false });
  });

  it("calls refresh-token-internal with the refresh token", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:5001";
    process.env.AUTH_API_KEY = "b64-client-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jwtToken: "jwt2",
          jwtExpiresSeconds: 900,
          refreshToken: "refresh2",
          refreshExpiresSeconds: 1000,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const authApi = await importFreshAuthApi();
    const result = await authApi.refreshTokenInternal("old-refresh");

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:5001/Auth/refresh-token-internal");
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: "old-refresh" });
  });

  it("calls logout with userId and refreshToken", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:5001";
    process.env.AUTH_API_KEY = "b64-client-key";

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const authApi = await importFreshAuthApi();
    const result = await authApi.logout("user-id-1", "refresh-1");

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:5001/Auth/logout");
    expect(JSON.parse(init.body as string)).toEqual({
      userId: "user-id-1",
      refreshToken: "refresh-1",
    });
  });
});

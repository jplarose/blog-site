import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";

const refreshTokenInternal = vi.fn();

vi.mock("@/lib/auth/auth-api", () => ({
  refreshTokenInternal: (...args: unknown[]) => refreshTokenInternal(...args),
}));

const NEW_TOKENS = {
  jwtToken: "rotated-access-token",
  jwtExpiresSeconds: 900,
  refreshToken: "rotated-refresh-token",
  refreshExpiresSeconds: 1209600,
};

async function getSetCookies(response: Response): Promise<string[]> {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie ? headers.getSetCookie() : [];
}

describe("proxyApiRequest", () => {
  beforeEach(() => {
    refreshTokenInternal.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards multipart request bytes without decoding them as text", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const bytes = new Uint8Array([0, 255, 1, 2, 3]);
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://media.example/image.png" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", backendFetch);
    const request = new Request("http://localhost/api/media/images", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test-boundary",
      },
      body: bytes,
    });

    await proxyApiRequest(request, "/api/media/images");

    const init = backendFetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(bytes);
    expect((init.headers as Headers).get("content-type")).toContain(
      "boundary=test-boundary",
    );
  });

  it("sets Authorization from the access token cookie and does not forward the cookie header", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", backendFetch);

    const request = new Request("http://localhost/api/posts", {
      method: "GET",
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=my-access-token; ${REFRESH_TOKEN_COOKIE}=my-refresh-token`,
      },
    });

    await proxyApiRequest(request, "/api/posts");

    const init = backendFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer my-access-token");
    expect(headers.get("cookie")).toBeNull();
  });

  it("does not forward an incoming Authorization header from the browser", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", backendFetch);

    const request = new Request("http://localhost/api/posts", {
      method: "GET",
      headers: {
        authorization: "Bearer client-supplied-token",
      },
    });

    await proxyApiRequest(request, "/api/posts");

    const init = backendFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBeNull();
  });

  it("retries once with a rotated token after a 401, and attaches rotated cookies", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const unauthorized = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    const success = new Response(JSON.stringify({ ok: true, data: [1, 2, 3] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const backendFetch = vi.fn().mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", backendFetch);
    refreshTokenInternal.mockResolvedValue({ ok: true, data: NEW_TOKENS });

    const request = new Request("http://localhost/api/posts", {
      method: "GET",
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=expired-token; ${REFRESH_TOKEN_COOKIE}=valid-refresh-token`,
      },
    });

    const response = await proxyApiRequest(request, "/api/posts");
    const body = await response.json();

    expect(refreshTokenInternal).toHaveBeenCalledWith("valid-refresh-token");
    expect(backendFetch).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: [1, 2, 3] });

    const firstCallHeaders = backendFetch.mock.calls[0]?.[1].headers as Headers;
    const secondCallHeaders = backendFetch.mock.calls[1]?.[1].headers as Headers;
    expect(firstCallHeaders.get("authorization")).toBe("Bearer expired-token");
    expect(secondCallHeaders.get("authorization")).toBe("Bearer rotated-access-token");

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.includes("rotated-access-token"))).toBe(true);
    expect(setCookies.some((c) => c.includes("rotated-refresh-token"))).toBe(true);
    expect(JSON.stringify(body)).not.toContain("rotated-access-token");
    expect(JSON.stringify(body)).not.toContain("rotated-refresh-token");
  });

  it("clears cookies and returns 401 when the refresh attempt fails, without looping", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const unauthorized = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    const backendFetch = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal("fetch", backendFetch);
    refreshTokenInternal.mockResolvedValue({ ok: false, status: 401, unauthorized: true });

    const request = new Request("http://localhost/api/posts", {
      method: "GET",
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=expired-token; ${REFRESH_TOKEN_COOKIE}=expired-refresh-token`,
      },
    });

    const response = await proxyApiRequest(request, "/api/posts");

    expect(refreshTokenInternal).toHaveBeenCalledTimes(1);
    expect(backendFetch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(401);

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
  });

  it("clears cookies and returns 401 without calling refresh when there is no refresh cookie", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const unauthorized = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    const backendFetch = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal("fetch", backendFetch);

    const request = new Request("http://localhost/api/posts", {
      method: "GET",
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=expired-token`,
      },
    });

    const response = await proxyApiRequest(request, "/api/posts");

    expect(refreshTokenInternal).not.toHaveBeenCalled();
    expect(backendFetch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(401);

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
  });

  it("buffers the request body so a retried POST resends it identically", async () => {
    const { proxyApiRequest } = await import("@/lib/api-proxy");
    const unauthorized = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    const success = new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
    const backendFetch = vi.fn().mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", backendFetch);
    refreshTokenInternal.mockResolvedValue({ ok: true, data: NEW_TOKENS });

    const payload = JSON.stringify({ title: "Hello world", body: "x".repeat(500) });
    const request = new Request("http://localhost/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${ACCESS_TOKEN_COOKIE}=expired-token; ${REFRESH_TOKEN_COOKIE}=valid-refresh-token`,
      },
      body: payload,
    });

    await proxyApiRequest(request, "/api/posts");

    expect(backendFetch).toHaveBeenCalledTimes(2);
    const firstBody = new Uint8Array(
      backendFetch.mock.calls[0]?.[1].body as ArrayBuffer,
    );
    const secondBody = new Uint8Array(
      backendFetch.mock.calls[1]?.[1].body as ArrayBuffer,
    );
    expect(firstBody).toEqual(secondBody);
    expect(new TextDecoder().decode(secondBody)).toBe(payload);
  });
});

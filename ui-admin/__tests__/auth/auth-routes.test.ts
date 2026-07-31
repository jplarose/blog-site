import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";

const loginInternal = vi.fn();
const refreshTokenInternal = vi.fn();
const logout = vi.fn();

vi.mock("@/lib/auth/auth-api", () => ({
  loginInternal: (...args: unknown[]) => loginInternal(...args),
  refreshTokenInternal: (...args: unknown[]) => refreshTokenInternal(...args),
  logout: (...args: unknown[]) => logout(...args),
}));

function base64url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeUnsignedJwt(payload: Record<string, unknown>) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

const TOKENS = {
  jwtToken: "new-access-token",
  jwtExpiresSeconds: 900,
  refreshToken: "new-refresh-token",
  refreshExpiresSeconds: 1209600,
};

async function getSetCookies(response: Response): Promise<string[]> {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie ? headers.getSetCookie() : [];
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    loginInternal.mockReset();
    refreshTokenInternal.mockReset();
    logout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets both session cookies HttpOnly with correct maxAge and returns no token material on success", async () => {
    loginInternal.mockResolvedValue({ ok: true, data: TOKENS });
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "user@example.com", password: "correct-horse" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("new-access-token");
    expect(JSON.stringify(body)).not.toContain("new-refresh-token");

    const setCookies = await getSetCookies(response);
    expect(setCookies).toHaveLength(2);

    const accessCookie = setCookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    const refreshCookie = setCookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(accessCookie).toMatch(/Max-Age=900/i);
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Max-Age=1209600/i);

    expect(loginInternal).toHaveBeenCalledWith("user@example.com", "correct-horse");
  });

  it("returns 401 with a generic error on bad credentials", async () => {
    loginInternal.mockResolvedValue({ ok: false, status: 401, unauthorized: true });
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "user@example.com", password: "wrong" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 400 when fields are missing, without calling the Auth API", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "user@example.com" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(loginInternal).not.toHaveBeenCalled();
  });

  it("returns 502 with a generic message when the Auth API fails, without leaking upstream details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    loginInternal.mockResolvedValue({ ok: false, status: 500, unauthorized: false });
    const { POST } = await import("@/app/api/auth/login/route");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "user@example.com", password: "secret" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(typeof body.error).toBe("string");
    expect(JSON.stringify(body)).not.toContain("500");
  });
});

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    loginInternal.mockReset();
    refreshTokenInternal.mockReset();
    logout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 and clears cookies when no refresh cookie is present", async () => {
    const { POST } = await import("@/app/api/auth/refresh/route");

    const request = new Request("http://localhost/api/auth/refresh", { method: "POST" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBeDefined();
    expect(refreshTokenInternal).not.toHaveBeenCalled();

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
  });

  it("rotates cookies on a successful refresh", async () => {
    refreshTokenInternal.mockResolvedValue({ ok: true, data: TOKENS });
    const { POST } = await import("@/app/api/auth/refresh/route");

    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=old-refresh-token` },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(refreshTokenInternal).toHaveBeenCalledWith("old-refresh-token");

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.includes("new-access-token"))).toBe(true);
    expect(setCookies.some((c) => c.includes("new-refresh-token"))).toBe(true);
  });

  it("clears cookies and returns 401 when the upstream refresh is rejected", async () => {
    refreshTokenInternal.mockResolvedValue({ ok: false, status: 401, unauthorized: true });
    const { POST } = await import("@/app/api/auth/refresh/route");

    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=expired-refresh-token` },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    loginInternal.mockReset();
    refreshTokenInternal.mockReset();
    logout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the Auth API with userId and refreshToken, and clears cookies", async () => {
    logout.mockResolvedValue({ ok: true, data: undefined });
    const accessToken = makeUnsignedJwt({ sub: "user-guid-1", role: "Admin", jti: "jti-1" });
    const { POST } = await import("@/app/api/auth/logout/route");

    const request = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}; ${REFRESH_TOKEN_COOKIE}=refresh-abc`,
      },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(logout).toHaveBeenCalledWith("user-guid-1", "refresh-abc");

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
  });

  it("still clears cookies and returns ok when the upstream logout call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    logout.mockRejectedValue(new Error("network down"));
    const accessToken = makeUnsignedJwt({ sub: "user-guid-2", role: "Admin", jti: "jti-2" });
    const { POST } = await import("@/app/api/auth/logout/route");

    const request = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}; ${REFRESH_TOKEN_COOKIE}=refresh-def`,
      },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });

    const setCookies = await getSetCookies(response);
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && /Max-Age=0/i.test(c))).toBe(true);
  });

  it("clears cookies without calling upstream when there are no session cookies", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");

    const request = new Request("http://localhost/api/auth/logout", { method: "POST" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(logout).not.toHaveBeenCalled();
  });
});

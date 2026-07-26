import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  buildClearedCookieHeaders,
  buildSessionCookieHeaders,
  getAccessToken,
  getRefreshToken,
  getUserIdFromAccessToken,
} from "@/lib/auth/session";

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

describe("session cookies", () => {
  const tokens = {
    jwtToken: "access-token-value",
    jwtExpiresSeconds: 900,
    refreshToken: "refresh-token-value",
    refreshExpiresSeconds: 1209600,
  };

  it("builds set-cookie headers for both tokens with httpOnly, sameSite=lax, path=/, and maxAge from the response", () => {
    const cookies = buildSessionCookieHeaders(tokens);

    expect(cookies).toHaveLength(2);

    const accessCookie = cookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    const refreshCookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();

    expect(accessCookie).toContain("access-token-value");
    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(accessCookie).toMatch(/SameSite=Lax/i);
    expect(accessCookie).toMatch(/Path=\//i);
    expect(accessCookie).toMatch(/Max-Age=900/i);

    expect(refreshCookie).toContain("refresh-token-value");
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Lax/i);
    expect(refreshCookie).toMatch(/Path=\//i);
    expect(refreshCookie).toMatch(/Max-Age=1209600/i);
  });

  it("does not mark cookies Secure outside production", () => {
    const cookies = buildSessionCookieHeaders(tokens);
    for (const cookie of cookies) {
      expect(cookie).not.toMatch(/Secure/i);
    }
  });

  describe("in production", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("marks session cookies Secure when NODE_ENV=production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const cookies = buildSessionCookieHeaders(tokens);

      expect(cookies).toHaveLength(2);
      const accessCookie = cookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
      const refreshCookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

      expect(accessCookie).toMatch(/Secure/i);
      expect(refreshCookie).toMatch(/Secure/i);
    });

    it("marks cleared cookies Secure when NODE_ENV=production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const cookies = buildClearedCookieHeaders();

      expect(cookies).toHaveLength(2);
      const accessCookie = cookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
      const refreshCookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

      expect(accessCookie).toMatch(/Secure/i);
      expect(refreshCookie).toMatch(/Secure/i);
    });
  });

  it("builds expiring set-cookie headers that clear both cookies", () => {
    const cookies = buildClearedCookieHeaders();

    expect(cookies).toHaveLength(2);
    const accessCookie = cookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    const refreshCookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

    expect(accessCookie).toMatch(/Max-Age=0/i);
    expect(refreshCookie).toMatch(/Max-Age=0/i);
  });

  it("reads the access and refresh tokens from the request cookie header", () => {
    const request = new Request("http://localhost/api/auth/refresh", {
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=abc123; ${REFRESH_TOKEN_COOKIE}=def456`,
      },
    });

    expect(getAccessToken(request)).toBe("abc123");
    expect(getRefreshToken(request)).toBe("def456");
  });

  it("returns null for tokens when the cookie header is absent", () => {
    const request = new Request("http://localhost/api/auth/refresh");

    expect(getAccessToken(request)).toBeNull();
    expect(getRefreshToken(request)).toBeNull();
  });
});

describe("getUserIdFromAccessToken", () => {
  it("returns the sub claim for a valid unsigned test JWT", () => {
    const token = makeUnsignedJwt({ sub: "11111111-1111-1111-1111-111111111111", role: "Admin", jti: "abc" });

    expect(getUserIdFromAccessToken(token)).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("returns null for garbage input", () => {
    expect(getUserIdFromAccessToken("not-a-jwt")).toBeNull();
    expect(getUserIdFromAccessToken(null)).toBeNull();
    expect(getUserIdFromAccessToken("")).toBeNull();
    expect(getUserIdFromAccessToken("a.b")).toBeNull();
    expect(getUserIdFromAccessToken("a.b.c")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";

function makeRequest(path: string, cookieHeader?: string) {
  return new NextRequest(
    new Request(`http://localhost${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    }),
  );
}

describe("middleware", () => {
  it("redirects an unauthenticated page request to /login", () => {
    const response = middleware(makeRequest("/dashboard"));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/login");
  });

  it("returns 401 JSON for an unauthenticated /api request", async () => {
    const response = middleware(makeRequest("/api/posts"));

    expect(response?.status).toBe(401);
    const body = await response?.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("passes through when the access token cookie is present", () => {
    const response = middleware(
      makeRequest("/dashboard", `${ACCESS_TOKEN_COOKIE}=some-token`),
    );

    // NextResponse.next() has no location header and a 200-ish passthrough status.
    expect(response?.headers.get("location")).toBeNull();
  });

  it("passes through when only the refresh token cookie is present", () => {
    const response = middleware(
      makeRequest("/dashboard", `${REFRESH_TOKEN_COOKIE}=some-refresh`),
    );

    expect(response?.headers.get("location")).toBeNull();
  });

  it("redirects /login to /dashboard when a session cookie is present", () => {
    const response = middleware(
      makeRequest("/login", `${ACCESS_TOKEN_COOKIE}=some-token`),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("lets an unauthenticated request through to /login", () => {
    const response = middleware(makeRequest("/login"));

    expect(response?.headers.get("location")).toBeNull();
  });
});

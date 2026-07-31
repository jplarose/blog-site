import "server-only";

export const ACCESS_TOKEN_COOKIE = "admin_access_token";
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token";

export interface SessionTokens {
  jwtToken: string;
  jwtExpiresSeconds: number;
  refreshToken: string;
  refreshExpiresSeconds: number;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isProduction()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function serializeExpiredCookie(name: string): string {
  const attributes = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (isProduction()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

/** Builds Set-Cookie header values for a fresh login/refresh response. */
export function buildSessionCookieHeaders(tokens: SessionTokens): string[] {
  return [
    serializeCookie(ACCESS_TOKEN_COOKIE, tokens.jwtToken, tokens.jwtExpiresSeconds),
    serializeCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, tokens.refreshExpiresSeconds),
  ];
}

/** Builds Set-Cookie header values that immediately expire both session cookies. */
export function buildClearedCookieHeaders(): string[] {
  return [
    serializeExpiredCookie(ACCESS_TOKEN_COOKIE),
    serializeExpiredCookie(REFRESH_TOKEN_COOKIE),
  ];
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

/** Reads the admin access token from the request's Cookie header, or null if absent. */
export function getAccessToken(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[ACCESS_TOKEN_COOKIE] ?? null;
}

/** Reads the admin refresh token from the request's Cookie header, or null if absent. */
export function getRefreshToken(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[REFRESH_TOKEN_COOKIE] ?? null;
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const paddingNeeded = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(paddingNeeded);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Extracts the `sub` claim from a JWT payload without verifying the signature.
 * The BFF only holds the cookie; signature validation happens in the .NET API.
 * Returns null for any malformed input instead of throwing.
 */
export function getUserIdFromAccessToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as { sub?: unknown };

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

import "server-only";

import { refreshTokenInternal } from "@/lib/auth/auth-api";
import { isDevAuthBypassEnabled, mintDevAccessToken } from "@/lib/auth/dev-bypass";
import {
  buildClearedCookieHeaders,
  buildSessionCookieHeaders,
  getAccessToken,
  getRefreshToken,
} from "@/lib/auth/session";

const BACKEND_API_BASE_URL =
  process.env.DOTNET_APP_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000";

// `cookie` and `authorization` are intentionally excluded: the browser's cookies
// must never leak to the .NET API, and the Authorization header is set server-side
// from the session's access token cookie instead of trusting an incoming header.
const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
] as const;

const RESPONSE_HEADER_BLOCKLIST = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
]);

function buildBackendUrl(path: string, request: Request) {
  const incomingUrl = new URL(request.url);
  const normalizedBaseUrl = BACKEND_API_BASE_URL.endsWith("/")
    ? BACKEND_API_BASE_URL.slice(0, -1)
    : BACKEND_API_BASE_URL;

  return `${normalizedBaseUrl}${path}${incomingUrl.search}`;
}

function buildProxyHeaders(request: Request, accessToken: string | null) {
  const headers = new Headers();

  for (const headerName of REQUEST_HEADER_ALLOWLIST) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

function buildResponseHeaders(headers: Headers) {
  const forwardedHeaders = new Headers();

  headers.forEach((value, key) => {
    if (!RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) {
      forwardedHeaders.set(key, value);
    }
  });

  return forwardedHeaders;
}

/**
 * Buffers the request body once (as an ArrayBuffer) so it can be resent
 * unchanged if the proxy needs to retry the request after a token refresh.
 */
async function readRequestBody(request: Request): Promise<ArrayBuffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

function unauthorizedResponse(): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of buildClearedCookieHeaders()) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers,
  });
}

export async function proxyApiRequest(request: Request, path: string) {
  const backendUrl = buildBackendUrl(path, request);
  const requestBody = await readRequestBody(request);
  const accessToken =
    getAccessToken(request) ?? (isDevAuthBypassEnabled() ? mintDevAccessToken() : null);

  const sendToBackend = (token: string | null) =>
    fetch(backendUrl, {
      method: request.method,
      headers: buildProxyHeaders(request, token),
      body: requestBody,
      cache: "no-store",
    });

  const backendResponse = await sendToBackend(accessToken);

  if (backendResponse.status !== 401) {
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: buildResponseHeaders(backendResponse.headers),
    });
  }

  // Attempt exactly one refresh-and-retry; never loop on repeated 401s.
  const refreshToken = getRefreshToken(request);
  if (!refreshToken) {
    return unauthorizedResponse();
  }

  const refreshResult = await refreshTokenInternal(refreshToken);
  if (!refreshResult.ok) {
    return unauthorizedResponse();
  }

  const retryResponse = await sendToBackend(refreshResult.data.jwtToken);
  const headers = buildResponseHeaders(retryResponse.headers);
  for (const cookie of buildSessionCookieHeaders(refreshResult.data)) {
    headers.append("set-cookie", cookie);
  }

  return new Response(retryResponse.body, {
    status: retryResponse.status,
    statusText: retryResponse.statusText,
    headers,
  });
}

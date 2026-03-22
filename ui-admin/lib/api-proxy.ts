import "server-only";

const BACKEND_API_BASE_URL =
  process.env.DOTNET_APP_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000";

const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
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

function buildProxyHeaders(request: Request) {
  const headers = new Headers();

  for (const headerName of REQUEST_HEADER_ALLOWLIST) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
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

async function buildRequestBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const body = await request.text();
  return body.length > 0 ? body : undefined;
}

export async function proxyApiRequest(request: Request, path: string) {
  const backendResponse = await fetch(buildBackendUrl(path, request), {
    method: request.method,
    headers: buildProxyHeaders(request),
    body: await buildRequestBody(request),
    cache: "no-store",
  });

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: buildResponseHeaders(backendResponse.headers),
  });
}

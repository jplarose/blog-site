import { refreshTokenInternal } from "@/lib/auth/auth-api";
import { buildClearedCookieHeaders, buildSessionCookieHeaders, getRefreshToken } from "@/lib/auth/session";

function jsonResponse(body: unknown, status: number, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(request: Request) {
  const refreshToken = getRefreshToken(request);

  if (!refreshToken) {
    return jsonResponse({ error: "No active session" }, 401, buildClearedCookieHeaders());
  }

  let result;
  try {
    result = await refreshTokenInternal(refreshToken);
  } catch (error) {
    console.error("Auth API refresh-token-internal request failed:", error);
    return jsonResponse({ error: "Unable to reach the authentication service" }, 502);
  }

  if (!result.ok) {
    return jsonResponse({ error: "Session expired" }, 401, buildClearedCookieHeaders());
  }

  return jsonResponse({ ok: true }, 200, buildSessionCookieHeaders(result.data));
}

import { logout } from "@/lib/auth/auth-api";
import {
  buildClearedCookieHeaders,
  getAccessToken,
  getRefreshToken,
  getUserIdFromAccessToken,
} from "@/lib/auth/session";

function jsonResponse(body: unknown, status: number, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(request: Request) {
  const accessToken = getAccessToken(request);
  const refreshToken = getRefreshToken(request);
  const userId = getUserIdFromAccessToken(accessToken);

  if (userId && refreshToken) {
    try {
      // Best-effort: a failed upstream call still clears local cookies below,
      // so the user is never stranded in a logged-in-looking state.
      await logout(userId, refreshToken);
    } catch (error) {
      console.error("Auth API logout request failed:", error);
    }
  }

  return jsonResponse({ ok: true }, 200, buildClearedCookieHeaders());
}

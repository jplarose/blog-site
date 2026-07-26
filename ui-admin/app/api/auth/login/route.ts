import { loginInternal } from "@/lib/auth/auth-api";
import { buildSessionCookieHeaders } from "@/lib/auth/session";

function jsonResponse(body: unknown, status: number, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { identifier, password } = (payload ?? {}) as {
    identifier?: unknown;
    password?: unknown;
  };

  if (typeof identifier !== "string" || !identifier || typeof password !== "string" || !password) {
    return jsonResponse({ error: "identifier and password are required" }, 400);
  }

  let result;
  try {
    result = await loginInternal(identifier, password);
  } catch (error) {
    console.error("Auth API login-internal request failed:", error);
    return jsonResponse({ error: "Unable to reach the authentication service" }, 502);
  }

  if (!result.ok) {
    if (result.unauthorized) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    console.error("Auth API login-internal returned an unexpected status:", result.status);
    return jsonResponse({ error: "Unable to reach the authentication service" }, 502);
  }

  return jsonResponse({ ok: true }, 200, buildSessionCookieHeaders(result.data));
}

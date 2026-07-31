import "server-only";

import type { SessionTokens } from "@/lib/auth/session";

export type AuthApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; unauthorized: boolean };

function getAuthApiBaseUrl(): string {
  const baseUrl = process.env.AUTH_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "AUTH_API_BASE_URL is not configured. Set it to the Auth API's base URL (e.g. http://localhost:5001).",
    );
  }

  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function getAuthApiKey(): string {
  const apiKey = process.env.AUTH_API_KEY;

  if (!apiKey) {
    throw new Error(
      "AUTH_API_KEY is not configured. Set it to the pre-encoded X-Api-Key value for this client.",
    );
  }

  return apiKey;
}

async function postToAuthApi<T>(path: string, body: unknown): Promise<AuthApiResult<T>> {
  const response = await fetch(`${getAuthApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Api-Key": getAuthApiKey(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      unauthorized: response.status === 401,
    };
  }

  const text = await response.text();
  const data = (text.length > 0 ? JSON.parse(text) : undefined) as T;
  return { ok: true, data };
}

/** Exchanges credentials for a fresh session via the Auth API's internal login route. */
export function loginInternal(
  identifier: string,
  password: string,
): Promise<AuthApiResult<SessionTokens>> {
  return postToAuthApi<SessionTokens>("/Auth/login-internal", { identifier, password });
}

/** Rotates a refresh token for a fresh session via the Auth API's internal refresh route. */
export function refreshTokenInternal(
  refreshToken: string,
): Promise<AuthApiResult<SessionTokens>> {
  return postToAuthApi<SessionTokens>("/Auth/refresh-token-internal", { refreshToken });
}

/** Revokes a refresh token (and its cached JTI) via the Auth API's logout route. */
export function logout(userId: string, refreshToken: string): Promise<AuthApiResult<undefined>> {
  return postToAuthApi<undefined>("/Auth/logout", { userId, refreshToken });
}

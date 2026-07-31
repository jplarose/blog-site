import "server-only";

import { createHmac, randomUUID } from "node:crypto";

/**
 * Local-development auth bypass. When DEV_AUTH_BYPASS=true (and not running
 * a production build), the middleware treats every request as authenticated
 * and the API proxy mints its own short-lived JWT signed with the shared dev
 * secret instead of requiring a session from the Auth API.
 *
 * The .NET API still fully validates the token's signature, issuer, audience,
 * and lifetime — this only removes the need for the Auth API to be running.
 */

const DEV_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour; proxy mints per request anyway
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

/**
 * Mints an HS256 JWT accepted by the .NET API's bearer validation.
 * Requires DEV_JWT_SECRET, DEV_JWT_ISSUER, and DEV_JWT_AUDIENCE to match the
 * API's Auth:Jwt settings (see api/appsettings.Development.json).
 */
export function mintDevAccessToken(): string {
  if (!isDevAuthBypassEnabled()) {
    throw new Error("mintDevAccessToken called while DEV_AUTH_BYPASS is not enabled.");
  }

  const secret = process.env.DEV_JWT_SECRET;
  const issuer = process.env.DEV_JWT_ISSUER;
  const audience = process.env.DEV_JWT_AUDIENCE;

  if (!secret || !issuer || !audience) {
    throw new Error(
      "DEV_AUTH_BYPASS requires DEV_JWT_SECRET, DEV_JWT_ISSUER, and DEV_JWT_AUDIENCE " +
        "to match the API's Auth:Jwt configuration.",
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: DEV_USER_ID,
    jti: randomUUID(),
    role: "Admin",
    iss: issuer,
    aud: audience,
    iat: nowSeconds,
    exp: nowSeconds + DEV_TOKEN_TTL_SECONDS,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}

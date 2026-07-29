import { ApiError } from "@/lib/api";

/** Statuses whose body is the service's own user-facing message. */
const PASS_THROUGH_STATUSES = new Set([400, 404, 409]);

/**
 * Strips the `apiFetch`-added "API error NNN: " prefix from 400/404/409
 * responses so the service's own validation/not-found/duplicate/referenced
 * message reaches the user verbatim. Other statuses (e.g. 500) fall back to
 * a generic message so unexpected server errors don't leak internals — a
 * raw backend body (stack traces, framework details) must never render
 * inside a user-facing alert.
 *
 * Shared across features (not taxonomy-specific) despite living alongside
 * `lib/taxonomy/errorMessage.ts`, which re-exports this for its existing
 * callers plus its own `staleRowMessage` helper.
 */
export function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return PASS_THROUGH_STATUSES.has(error.status)
      ? error.message.replace(/^API error \d+: /, "") || fallback
      : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

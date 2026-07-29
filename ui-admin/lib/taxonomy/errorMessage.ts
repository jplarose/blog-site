import { ApiError } from "@/lib/api";

/** Statuses whose body is the service's own user-facing message. */
const PASS_THROUGH_STATUSES = new Set([400, 404, 409]);

/**
 * Strips the `apiFetch`-added "API error NNN: " prefix from 400/404/409
 * responses so the service's own validation/not-found/duplicate/referenced
 * message reaches the user verbatim — this covers the full failure matrix
 * (invalid payload, missing id, duplicate name/slug, referenced-delete).
 * Other statuses fall back to a generic message so unexpected server
 * errors don't leak internals.
 */
export function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return PASS_THROUGH_STATUSES.has(error.status)
      ? error.message.replace(/^API error \d+: /, "") || fallback
      : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Copy shown when an update/delete 404s because the row was already
 * removed elsewhere (another tab, another admin) between the list load and
 * the action. Distinct from both the duplicate-on-save and
 * referenced-on-delete 409 messages.
 */
export function staleRowMessage(entityLabel: string, name: string): string {
  return `"${name}" no longer exists — it looks like this ${entityLabel} was already deleted elsewhere. The list has been refreshed.`;
}

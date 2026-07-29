import { ApiError } from "@/lib/api";

/**
 * Strips the `apiFetch`-added "API error NNN: " prefix from 400/409
 * responses so the service's own validation/duplicate/referenced message
 * reaches the user verbatim. Other statuses fall back to a generic message
 * so unexpected server errors don't leak internals.
 */
export function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.status === 400 || error.status === 409
      ? error.message.replace(/^API error \d+: /, "") || fallback
      : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

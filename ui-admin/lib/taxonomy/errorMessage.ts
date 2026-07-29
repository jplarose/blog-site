/**
 * Re-exported from `lib/errorMessage.ts` (extracted from here in #43 so
 * non-taxonomy features, e.g. the dashboard/analytics pages, can share the
 * same safe-status-passthrough logic without an odd `lib/taxonomy` import).
 * Kept re-exported here so existing taxonomy callers are unaffected.
 */
export { friendlyErrorMessage } from "@/lib/errorMessage";

/**
 * Copy shown when an update/delete 404s because the row was already
 * removed elsewhere (another tab, another admin) between the list load and
 * the action. Distinct from both the duplicate-on-save and
 * referenced-on-delete 409 messages.
 */
export function staleRowMessage(entityLabel: string, name: string): string {
  return `"${name}" no longer exists — it looks like this ${entityLabel} was already deleted elsewhere. The list has been refreshed.`;
}

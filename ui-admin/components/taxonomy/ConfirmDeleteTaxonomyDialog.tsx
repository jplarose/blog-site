"use client";

import Modal from "@/components/ui/Modal";

interface ConfirmDeleteTaxonomyDialogProps {
  /** Lowercase noun used in copy, e.g. "category" or "tag". */
  entityLabel: string;
  itemName: string;
  isSubmitting: boolean;
  /** Raw API error message from a failed delete attempt, if any. */
  serverError: string | null;
  /**
   * Post count known from the list the delete failed against. When set
   * alongside a referenced-delete conflict, it drives a distinct "in use by
   * N posts" message instead of relaying the API's generic wording, so
   * duplicate-on-save and referenced-on-delete never read the same.
   */
  referencedByPostCount?: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms a permanent category/tag deletion. Modal chrome (focus trap,
 * focus restore, background inert) lives in the shared `Modal` component;
 * Cancel is the first focusable element so it receives initial focus,
 * keeping the destructive action from being the accidental default.
 */
export default function ConfirmDeleteTaxonomyDialog({
  entityLabel,
  itemName,
  isSubmitting,
  serverError,
  referencedByPostCount,
  onCancel,
  onConfirm,
}: ConfirmDeleteTaxonomyDialogProps) {
  const errorMessage = referencedErrorMessage(entityLabel, referencedByPostCount) ?? serverError;

  return (
    <Modal labelledBy="confirm-delete-taxonomy-title" onClose={onCancel}>
      <h2 id="confirm-delete-taxonomy-title" className="text-lg font-semibold text-gray-900">
        Delete &ldquo;{itemName}&rdquo;?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        This permanently deletes the {entityLabel}. This action cannot be undone.
      </p>

      {errorMessage ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
        >
          {isSubmitting ? "Deleting…" : `Delete ${entityLabel}`}
        </button>
      </div>
    </Modal>
  );
}

function referencedErrorMessage(entityLabel: string, postCount?: number): string | null {
  if (postCount === undefined) return null;
  const postWord = postCount === 1 ? "post" : "posts";
  return `This ${entityLabel} is in use by ${postCount} ${postWord} — reassign or remove those references first.`;
}

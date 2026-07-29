"use client";

import Modal from "@/components/ui/Modal";

interface ConfirmDeleteDialogProps {
  postTitle: string;
  isSubmitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms a permanent post deletion before calling the API. Modal chrome
 * (focus trap, focus restore, background inert) lives in the shared `Modal`
 * component; Cancel is the first focusable element in the dialog so it
 * receives initial focus, keeping the destructive action from being the
 * accidental default.
 */
export default function ConfirmDeleteDialog({
  postTitle,
  isSubmitting,
  serverError,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Modal labelledBy="confirm-delete-title" onClose={onCancel}>
      <h2 id="confirm-delete-title" className="text-lg font-semibold text-gray-900">
        Delete &ldquo;{postTitle}&rdquo;?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        This permanently deletes the post. This action cannot be undone.
      </p>

      {serverError ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {serverError}
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
          {isSubmitting ? "Deleting…" : "Delete post"}
        </button>
      </div>
    </Modal>
  );
}

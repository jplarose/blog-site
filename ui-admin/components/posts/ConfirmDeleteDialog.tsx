"use client";

import { useEffect, useRef } from "react";

interface ConfirmDeleteDialogProps {
  postTitle: string;
  isSubmitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirms a permanent post deletion before calling the API. */
export default function ConfirmDeleteDialog({
  postTitle,
  isSubmitting,
  serverError,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
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
            ref={cancelRef}
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
      </div>
    </div>
  );
}

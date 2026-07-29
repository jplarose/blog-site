"use client";

import { useEffect, useRef, useState } from "react";

import { datetimeLocalToIso, isStrictlyFuture } from "@/lib/posts/schedule";

interface ScheduleDialogProps {
  postTitle: string;
  isSubmitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onConfirm: (scheduledAtIso: string) => void;
}

/**
 * Confirms a future publish time for a post. There is no background
 * scheduler on the API — the copy here tells the owner that a Scheduled
 * post only goes live once they come back and publish it after the time.
 */
export default function ScheduleDialog({
  postTitle,
  isSubmitting,
  serverError,
  onCancel,
  onConfirm,
}: ScheduleDialogProps) {
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function handleConfirm() {
    const iso = datetimeLocalToIso(value);
    if (!iso) {
      setValidationError("Choose a publish date and time.");
      return;
    }
    if (!isStrictlyFuture(iso)) {
      setValidationError("The scheduled time must be in the future.");
      return;
    }
    setValidationError(null);
    onConfirm(iso);
  }

  const errorMessage = validationError ?? serverError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dialog-title"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="schedule-dialog-title" className="text-lg font-semibold text-gray-900">
          Schedule &ldquo;{postTitle}&rdquo;
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          This post will not go public automatically. Someone must come back and click
          Publish after the scheduled time.
        </p>

        <label htmlFor="schedule-dialog-datetime" className="mt-4 block text-sm font-medium text-gray-700">
          Publish date &amp; time
        </label>
        <input
          ref={inputRef}
          id="schedule-dialog-datetime"
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isSubmitting}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

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
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

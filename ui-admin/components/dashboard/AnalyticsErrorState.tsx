"use client";

import { useState } from "react";

interface AnalyticsErrorStateProps {
  message: string;
  onRetry: () => void;
}

/**
 * Friendly error box with a retry affordance for a failed analytics load.
 * The retry button disables itself for the duration of the retry so a
 * double-click can't fire two overlapping requests; `aria-live` announces
 * the failure to screen reader users without requiring focus to move.
 */
export default function AnalyticsErrorState({ message, onRetry }: AnalyticsErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={() => void handleRetry()}
        disabled={isRetrying}
        className="mt-3 inline-flex items-center rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

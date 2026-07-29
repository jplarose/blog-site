"use client";

import { useCallback, useEffect, useState } from "react";

import { analyticsApi, type AnalyticsSummary } from "@/lib/api";

export type AnalyticsSummaryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AnalyticsSummary };

/**
 * Loads the 30-day analytics summary once on mount and exposes a `reload`
 * callback for a retry affordance. A 401 is handled globally by `apiFetch`
 * (redirects to /login), so any error surfaced here is a genuine failure —
 * network trouble or a server error — worth a friendly retry prompt.
 *
 * The fetch itself lives inside the effect (mirroring
 * `components/taxonomy/CategoriesManager`'s load pattern) rather than being
 * invoked through a memoized callback dependency — calling a `useCallback`
 * function from inside `useEffect` trips the `react-hooks/set-state-in-effect`
 * lint rule. `reload` instead bumps a token that the effect depends on.
 */
export function useAnalyticsSummary(days = 30) {
  const [state, setState] = useState<AnalyticsSummaryState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadSummary() {
      setState({ status: "loading" });
      try {
        const data = await analyticsApi.summary(days);
        if (isActive) setState({ status: "ready", data });
      } catch (error) {
        if (!isActive) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load analytics.",
        });
      }
    }

    void loadSummary();
    return () => {
      isActive = false;
    };
  }, [days, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { state, reload };
}

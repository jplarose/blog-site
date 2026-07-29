"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordPageView } from "@/lib/api";

interface Props {
  /** Pass the post id on post detail pages; omit (or pass null) elsewhere. */
  postId?: number | null;
}

/**
 * Records a fire-and-forget pageview on mount, client-side.
 *
 * This intentionally does not run inside the server component that renders
 * the page: that render is cached by ISR (see `REVALIDATE_SECONDS` in
 * `lib/api.ts`) and only re-executes on cache misses, which would drastically
 * undercount real visits. Mounting this client component means every actual
 * browser visit fires a pageview, regardless of whether the surrounding page
 * markup came from cache.
 */
export default function PageViewRecorder({ postId = null }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    recordPageView(postId, pathname, typeof document !== "undefined" ? document.referrer || undefined : undefined);
  }, [postId, pathname]);

  return null;
}

"use client";

import { useCallback, useMemo, useState } from "react";

import { richTextToHtml } from "@/components/rte/toHtml";

interface RichTextContentProps {
  content: string | null | undefined;
  className?: string;
}

export default function RichTextContent({ content, className }: RichTextContentProps) {
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<number>>(new Set());

  const html = useMemo(() => richTextToHtml(content), [content]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("spoiler") && !target.classList.contains("spoiler--revealed")) {
      return;
    }

    const container = event.currentTarget as HTMLElement;
    const spoilers = container.querySelectorAll(".spoiler, .spoiler--revealed");
    const index = Array.from(spoilers).indexOf(target);
    if (index === -1) {
      return;
    }

    setRevealedSpoilers((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const processedHtml = useMemo(() => {
    if (revealedSpoilers.size === 0) {
      return html;
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const spoilers = doc.querySelectorAll(".spoiler");
    spoilers.forEach((element, index) => {
      if (revealedSpoilers.has(index)) {
        element.classList.remove("spoiler");
        element.classList.add("spoiler--revealed");
      }
    });

    return doc.body.innerHTML;
  }, [html, revealedSpoilers]);

  if (!content) {
    return null;
  }

  return (
    <div
      className={`rte-content ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      onClick={handleClick}
    />
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Spoiler } from "@/components/rte/extensions/spoiler";
import { sanitizeHtml } from "@/components/rte/sanitize";

interface RichTextContentProps {
  content: string | null | undefined;
  className?: string;
}

function isJsonContent(value: string): boolean {
  if (!value.startsWith("{") && !value.startsWith("[")) {
    return false;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed?.type === "doc" || Array.isArray(parsed?.content);
  } catch {
    return false;
  }
}

const extensions = [
  StarterKit.configure({
    link: false,
    underline: false,
    heading: false,
    codeBlock: false,
    code: false,
    blockquote: false,
    horizontalRule: false,
  }),
  Underline,
  Link.configure({
    openOnClick: true,
    HTMLAttributes: {
      target: "_blank",
      rel: "noopener noreferrer",
    },
  }),
  Spoiler,
];

export default function RichTextContent({ content, className }: RichTextContentProps) {
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<number>>(new Set());

  const html = useMemo(() => {
    if (!content) {
      return "";
    }

    const trimmedContent = content.trimStart();
    if (isJsonContent(trimmedContent)) {
      try {
        const json: JSONContent = JSON.parse(trimmedContent);
        return sanitizeHtml(generateHTML(json, extensions));
      } catch {
        return sanitizeHtml(`<p>${content}</p>`);
      }
    }

    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    return `<p>${escaped}</p>`;
  }, [content]);

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

import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Spoiler } from "@/components/rte/extensions/spoiler";
import { sanitizeHtml } from "@/components/rte/sanitize";

const READ_EXTENSIONS = [
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

/**
 * Converts a post's stored `content` field (either a serialized Tiptap
 * JSON document, or legacy plain text) into sanitized display HTML.
 * Shared by `RichTextContent` (post detail/list views) and the template
 * preview (post editor).
 */
export function richTextToHtml(content: string | null | undefined): string {
  if (!content) {
    return "";
  }

  const trimmedContent = content.trimStart();
  if (isJsonContent(trimmedContent)) {
    try {
      const json: JSONContent = JSON.parse(trimmedContent);
      return sanitizeHtml(generateHTML(json, READ_EXTENSIONS));
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
}

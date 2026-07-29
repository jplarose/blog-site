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
 * Converts a Tiptap editor document into sanitized rich HTML. This is the
 * wire format for a post's `content` field: the admin submits HTML, the API
 * sanitizes HTML (issue #34), and the public site renders HTML verbatim
 * through its templates.
 */
export function richTextJsonToHtml(json: JSONContent): string {
  return sanitizeHtml(generateHTML(json, READ_EXTENSIONS));
}

/**
 * Converts a post's `content` field into sanitized display HTML. Accepts
 * the canonical stored shape (sanitized rich HTML), a serialized Tiptap
 * JSON document (in-editor state / legacy rows), or legacy plain text.
 * Shared by `RichTextContent` (post detail/list views), the template
 * preview, and the post editor's save path.
 */
export function richTextToHtml(content: string | null | undefined): string {
  if (!content) {
    return "";
  }

  const trimmedContent = content.trimStart();
  if (isJsonContent(trimmedContent)) {
    try {
      const json: JSONContent = JSON.parse(trimmedContent);
      return richTextJsonToHtml(json);
    } catch {
      return sanitizeHtml(`<p>${content}</p>`);
    }
  }

  if (trimmedContent.startsWith("<")) {
    // Already rich HTML (the canonical stored format) — sanitize, don't escape.
    return sanitizeHtml(content);
  }

  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p>${escaped}</p>`;
}

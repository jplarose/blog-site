"use client";

import type { JSONContent } from "@tiptap/react";
import { useEditor } from "@tiptap/react";

import type { RichTextEditorFeatures } from "@/components/rte/types";
import { buildExtensions } from "@/components/rte/utils";

interface UseRichTextEditorOptions {
  initialContent?: JSONContent | string;
  features?: RichTextEditorFeatures;
  placeholder?: string;
  onChange?: (json: JSONContent) => void;
  onBlur?: (json: JSONContent) => void;
  autoFocus?: boolean;
  editable?: boolean;
  ariaLabel?: string;
}

export function useRichTextEditor(options: UseRichTextEditorOptions) {
  const {
    initialContent,
    features,
    placeholder,
    onChange,
    onBlur,
    autoFocus = false,
    editable = true,
    ariaLabel,
  } = options;

  const content =
    typeof initialContent === "string" ? parseInitialContent(initialContent) : initialContent ?? "";

  return useEditor({
    extensions: buildExtensions({ features, placeholder }),
    content,
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    onBlur: ({ editor }) => {
      onBlur?.(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return false;
        }

        if (target.classList.contains("spoiler")) {
          target.classList.remove("spoiler");
          target.classList.add("spoiler--revealed");
          return true;
        }

        if (target.classList.contains("spoiler--revealed")) {
          target.classList.remove("spoiler--revealed");
          target.classList.add("spoiler");
          return true;
        }

        return false;
      },
    },
  });
}

function parseInitialContent(initialContent: string): JSONContent | string {
  const trimmedContent = initialContent.trim();
  if (!trimmedContent.startsWith("{") && !trimmedContent.startsWith("[")) {
    return initialContent;
  }

  try {
    const parsed = JSON.parse(trimmedContent) as JSONContent;
    if (parsed?.type === "doc" || Array.isArray(parsed?.content)) {
      return parsed;
    }
  } catch {
    return initialContent;
  }

  return initialContent;
}

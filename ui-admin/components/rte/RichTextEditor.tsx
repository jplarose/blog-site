"use client";

import { EditorContent } from "@tiptap/react";

import RichTextEditorToolbar from "@/components/rte/RichTextEditorToolbar";
import type { RichTextEditorProps } from "@/components/rte/types";
import { useRichTextEditor } from "@/components/rte/useRichTextEditor";

export default function RichTextEditor({
  initialContent,
  placeholder,
  onChange,
  onBlur,
  features,
  className,
  autoFocus = false,
  disabled = false,
  ariaLabel,
}: RichTextEditorProps) {
  const editor = useRichTextEditor({
    initialContent,
    features,
    placeholder,
    onChange,
    onBlur,
    autoFocus,
    editable: !disabled,
    ariaLabel,
  });

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${
        disabled ? "pointer-events-none opacity-50" : ""
      } ${className ?? ""}`}
    >
      <RichTextEditorToolbar editor={editor} features={features} />
      <EditorContent editor={editor} />
    </div>
  );
}

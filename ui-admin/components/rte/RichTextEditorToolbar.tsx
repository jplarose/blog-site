"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

import { DEFAULT_FEATURES, type RichTextEditorFeatures } from "@/components/rte/types";

interface RichTextEditorToolbarProps {
  editor: Editor | null;
  features?: RichTextEditorFeatures;
}

const DEFAULT_ACTIVE_STATES = {
  bold: false,
  italic: false,
  underline: false,
  spoiler: false,
  link: false,
  bulletList: false,
  orderedList: false,
};

export default function RichTextEditorToolbar({
  editor,
  features,
}: RichTextEditorToolbarProps) {
  const resolvedFeatures = { ...DEFAULT_FEATURES, ...features };
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const activeStates =
    useEditorState({
      editor,
      selector: (context) => ({
        bold: context.editor?.isActive("bold") ?? false,
        italic: context.editor?.isActive("italic") ?? false,
        underline: context.editor?.isActive("underline") ?? false,
        spoiler: context.editor?.isActive("spoiler") ?? false,
        link: context.editor?.isActive("link") ?? false,
        bulletList: context.editor?.isActive("bulletList") ?? false,
        orderedList: context.editor?.isActive("orderedList") ?? false,
      }),
    }) ?? DEFAULT_ACTIVE_STATES;

  const setLink = useCallback(() => {
    if (!editor || !linkInput.trim()) {
      return;
    }

    let url = linkInput.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:")) {
      url = `https://${url}`;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkInput("");
    setShowLinkInput(false);
  }, [editor, linkInput]);

  if (!editor) {
    return null;
  }

  const buttonClass = (active: boolean) =>
    `px-2 py-1 rounded text-sm font-medium transition ${
      active
        ? "bg-indigo-100 text-indigo-700"
        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      {resolvedFeatures.enableBold ? (
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={buttonClass(activeStates.bold)}
          aria-label="Bold"
          aria-pressed={activeStates.bold}
        >
          <strong>B</strong>
        </button>
      ) : null}
      {resolvedFeatures.enableItalic ? (
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={buttonClass(activeStates.italic)}
          aria-label="Italic"
          aria-pressed={activeStates.italic}
        >
          <em>I</em>
        </button>
      ) : null}
      {resolvedFeatures.enableUnderline ? (
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={buttonClass(activeStates.underline)}
          aria-label="Underline"
          aria-pressed={activeStates.underline}
        >
          <u>U</u>
        </button>
      ) : null}
      {resolvedFeatures.enableSpoiler ? (
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSpoiler().run()}
          className={buttonClass(activeStates.spoiler)}
          aria-label="Spoiler"
          aria-pressed={activeStates.spoiler}
        >
          &#x2588;
        </button>
      ) : null}
      {resolvedFeatures.enableLink ? (
        showLinkInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={linkInput}
              onChange={(event) => setLinkInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setLink();
                }
                if (event.key === "Escape") {
                  setShowLinkInput(false);
                  setLinkInput("");
                }
              }}
              placeholder="Enter URL..."
              className="w-40 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="button"
              onClick={setLink}
              className="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-500"
            >
              Set
            </button>
            <button
              type="button"
              onClick={() => {
                if (editor.isActive("link")) {
                  editor.chain().focus().unsetLink().run();
                }
                setShowLinkInput(false);
                setLinkInput("");
              }}
              className="rounded px-2 py-0.5 text-xs text-gray-500 hover:text-gray-900"
            >
              {activeStates.link ? "Unlink" : "Cancel"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLinkInput(true)}
            className={buttonClass(activeStates.link)}
            aria-label="Link"
            aria-pressed={activeStates.link}
          >
            &#x1F517;
          </button>
        )
      ) : null}
      {resolvedFeatures.enableLists ? (
        <>
          <span className="mx-1 h-4 w-px bg-gray-300" aria-hidden="true" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={buttonClass(activeStates.bulletList)}
            aria-label="Bullet list"
            aria-pressed={activeStates.bulletList}
          >
            &bull; List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={buttonClass(activeStates.orderedList)}
            aria-label="Numbered list"
            aria-pressed={activeStates.orderedList}
          >
            1. List
          </button>
        </>
      ) : null}
    </div>
  );
}

import type { AnyExtension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

import { MarkdownLink } from "@/components/rte/extensions/markdownLink";
import { Spoiler } from "@/components/rte/extensions/spoiler";
import { DEFAULT_FEATURES, type RichTextEditorFeatures } from "@/components/rte/types";

interface EditorConfigOptions {
  features?: RichTextEditorFeatures;
  placeholder?: string;
}

export function buildExtensions(options: EditorConfigOptions): AnyExtension[] {
  const features = { ...DEFAULT_FEATURES, ...options.features };
  const extensions: AnyExtension[] = [];

  extensions.push(
    StarterKit.configure({
      bold: features.enableBold ? {} : false,
      italic: features.enableItalic ? {} : false,
      bulletList: features.enableLists ? {} : false,
      orderedList: features.enableLists ? {} : false,
      listItem: features.enableLists ? {} : false,
      link: false,
      underline: false,
      heading: false,
      codeBlock: false,
      code: false,
      blockquote: false,
      horizontalRule: false,
    }),
  );

  if (features.enableUnderline) {
    extensions.push(Underline);
  }

  if (features.enableLink) {
    extensions.push(
      MarkdownLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    );
  }

  if (features.enableSpoiler) {
    extensions.push(Spoiler);
  }

  if (options.placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: options.placeholder,
      }),
    );
  }

  return extensions;
}

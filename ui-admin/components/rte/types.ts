import type { JSONContent } from "@tiptap/react";

export type { JSONContent };

export interface RichTextEditorFeatures {
  enableBold?: boolean;
  enableItalic?: boolean;
  enableUnderline?: boolean;
  enableSpoiler?: boolean;
  enableLink?: boolean;
  enableLists?: boolean;
}

export interface RichTextEditorProps {
  initialContent?: JSONContent | string;
  placeholder?: string;
  onChange?: (json: JSONContent) => void;
  onBlur?: (json: JSONContent) => void;
  features?: RichTextEditorFeatures;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export const DEFAULT_FEATURES: Required<RichTextEditorFeatures> = {
  enableBold: true,
  enableItalic: true,
  enableUnderline: true,
  enableSpoiler: true,
  enableLink: true,
  enableLists: true,
};

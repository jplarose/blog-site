export const TEMPLATE_BLOCK_KINDS = [
  "title",
  "richText",
  "image",
  "gallery",
  "column",
  "container",
] as const;

export type TemplateBlockKind = (typeof TEMPLATE_BLOCK_KINDS)[number];

export type TemplateWidthMode = "full" | "fixed" | "fraction";
export type TemplateBlockDirection = "row" | "column";
export type TemplateTextAlign = "left" | "center" | "right";
export type TemplateImageFit = "cover" | "contain";

export interface TemplateSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface TemplateBlockSize {
  widthMode?: TemplateWidthMode;
  widthValue?: number;
  minHeight?: number;
  maxWidth?: number;
  columnSpan?: number;
}

export interface TemplateBlockStyle {
  padding?: TemplateSpacing;
  margin?: TemplateSpacing;
  gap?: number;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  textAlign?: TemplateTextAlign;
}

export interface TemplateContentBindingBase {
  key: string;
  label: string;
  required?: boolean;
  helpText?: string;
}

export interface TemplateTextBinding extends TemplateContentBindingBase {
  kind: "plainText" | "richText";
  placeholder?: string;
}

export interface TemplateImageBinding extends TemplateContentBindingBase {
  kind: "image";
  aspectRatio?: string;
}

export interface TemplateGalleryBinding extends TemplateContentBindingBase {
  kind: "gallery";
  minItems?: number;
  maxItems?: number;
}

export type TemplateContentBinding =
  | TemplateTextBinding
  | TemplateImageBinding
  | TemplateGalleryBinding;

export interface TemplateBlockBase {
  id: string;
  kind: TemplateBlockKind;
  label: string;
  parentId?: string | null;
  size?: TemplateBlockSize;
  style?: TemplateBlockStyle;
}

export interface TitleTemplateBlock extends TemplateBlockBase {
  kind: "title";
  content: TemplateTextBinding;
  props?: {
    headingLevel?: 1 | 2 | 3;
  };
}

export interface RichTextTemplateBlock extends TemplateBlockBase {
  kind: "richText";
  content: TemplateTextBinding;
}

export interface ImageTemplateBlock extends TemplateBlockBase {
  kind: "image";
  content: TemplateImageBinding;
  props?: {
    altTextKey?: string;
    fit?: TemplateImageFit;
  };
}

export interface GalleryTemplateBlock extends TemplateBlockBase {
  kind: "gallery";
  content: TemplateGalleryBinding;
  props?: {
    columns?: number;
    showCaptions?: boolean;
  };
}

export interface ColumnTemplateBlock extends TemplateBlockBase {
  kind: "column";
  props?: {
    direction?: TemplateBlockDirection;
    columns?: number;
  };
  children: string[];
}

export interface ContainerTemplateBlock extends TemplateBlockBase {
  kind: "container";
  props?: {
    direction?: TemplateBlockDirection;
  };
  children: string[];
}

export type TemplateBlock =
  | TitleTemplateBlock
  | RichTextTemplateBlock
  | ImageTemplateBlock
  | GalleryTemplateBlock
  | ColumnTemplateBlock
  | ContainerTemplateBlock;

export interface TemplateCanvasSettings {
  width: number;
  minRowHeight: number;
  backgroundColor?: string;
}

export interface TemplateLayout {
  version: 1;
  canvas: TemplateCanvasSettings;
  rootBlockIds: string[];
  blocks: Record<string, TemplateBlock>;
}

export interface TemplateSummary {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  categoryCount?: number;
  postCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutTemplate extends TemplateSummary {
  layout: TemplateLayout;
}

export interface TemplateImageValue {
  url: string;
  alt?: string;
  caption?: string;
}

export interface TemplateGalleryItemValue extends TemplateImageValue {
  id: string;
}

export type TemplateContentValue =
  | string
  | TemplateImageValue
  | TemplateGalleryItemValue[];

export interface PostTemplateContent {
  templateId: number;
  values: Record<string, TemplateContentValue>;
}

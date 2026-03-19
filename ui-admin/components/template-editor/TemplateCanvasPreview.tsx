"use client";

import type { CSSProperties, ReactNode } from "react";

import RichTextContent from "@/components/rte/RichTextContent";
import type {
  TemplateBlock,
  TemplateContentValue,
  TemplateGalleryItemValue,
  TemplateImageValue,
  TemplateBlockStyle,
  TemplateLayout,
} from "@/lib/template-schema";

interface TemplateCanvasPreviewProps {
  layout: TemplateLayout;
  contentValues?: Record<string, TemplateContentValue>;
  postTitle?: string;
}

function toSpacingValue(
  spacing: TemplateBlockStyle["padding"] | TemplateBlockStyle["margin"],
) {
  if (!spacing) {
    return undefined;
  }

  return `${spacing.top ?? 0}px ${spacing.right ?? 0}px ${spacing.bottom ?? 0}px ${spacing.left ?? 0}px`;
}

function getBlockStyle(block: TemplateBlock): CSSProperties {
  const style: CSSProperties = {
    minHeight: block.size?.minHeight,
    maxWidth: block.size?.maxWidth,
    padding: toSpacingValue(block.style?.padding),
    margin: toSpacingValue(block.style?.margin),
    gap: block.style?.gap,
    backgroundColor: block.style?.backgroundColor,
    color: block.style?.textColor,
    borderRadius: block.style?.borderRadius,
    borderColor: block.style?.borderColor,
    borderWidth: block.style?.borderWidth,
    textAlign: block.style?.textAlign,
  };

  if (block.size?.widthMode === "full") {
    style.width = "100%";
  }

  if (block.size?.widthMode === "fixed" && block.size.widthValue) {
    style.width = `${block.size.widthValue}px`;
  }

  if (block.size?.widthMode === "fraction" && block.size.widthValue) {
    style.width = `${block.size.widthValue}%`;
  }

  return style;
}

function getContainerStyle(
  block: Extract<TemplateBlock, { kind: "column" | "container" }>,
): CSSProperties {
  return {
    display: "flex",
    flexDirection: block.props?.direction ?? "column",
    gap: block.style?.gap ?? 16,
  };
}

function getStringValue(
  contentValues: Record<string, TemplateContentValue> | undefined,
  bindingKey: string,
) {
  const value = contentValues?.[bindingKey];
  return typeof value === "string" ? value : "";
}

function getImageValue(
  contentValues: Record<string, TemplateContentValue> | undefined,
  bindingKey: string,
): TemplateImageValue | null {
  const value = contentValues?.[bindingKey];
  if (!value || typeof value === "string" || Array.isArray(value)) {
    return null;
  }

  return value;
}

function getGalleryValue(
  contentValues: Record<string, TemplateContentValue> | undefined,
  bindingKey: string,
): TemplateGalleryItemValue[] {
  const value = contentValues?.[bindingKey];
  return Array.isArray(value) ? value : [];
}

function renderLeafBlock(
  block: TemplateBlock,
  contentValues: Record<string, TemplateContentValue> | undefined,
  postTitle: string | undefined,
) {
  switch (block.kind) {
    case "title": {
      const headingLevel = block.props?.headingLevel ?? 1;
      const className =
        headingLevel === 1 ? "text-4xl" : headingLevel === 2 ? "text-3xl" : "text-2xl";
      const titleValue =
        postTitle || getStringValue(contentValues, block.content.key) || block.content.label;

      return (
        <div
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          style={getBlockStyle(block)}
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {block.label}
          </p>
          <p className={`${className} font-semibold text-slate-900`}>{titleValue}</p>
        </div>
      );
    }
    case "richText": {
      const richTextValue = getStringValue(contentValues, block.content.key);

      return (
        <div
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          style={getBlockStyle(block)}
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {block.label}
          </p>
          {richTextValue ? (
            <RichTextContent content={richTextValue} className="text-sm leading-7 text-slate-600" />
          ) : (
            <div className="space-y-3 text-sm leading-7 text-slate-400">
              <p>{block.content.label || "Rich text block"}</p>
              <p>Enter content for this block in the template-aware editor.</p>
            </div>
          )}
        </div>
      );
    }
    case "image": {
      const imageValue = getImageValue(contentValues, block.content.key);

      return (
        <div
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          style={getBlockStyle(block)}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {block.label}
          </p>
          {imageValue?.url ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageValue.url}
                alt={imageValue.alt || block.content.label}
                className="h-48 w-full rounded-lg object-cover"
              />
              {imageValue.caption ? (
                <p className="text-sm text-slate-500">{imageValue.caption}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
              {block.content.label || "Image"}
            </div>
          )}
        </div>
      );
    }
    case "gallery": {
      const galleryItems = getGalleryValue(contentValues, block.content.key);

      return (
        <div
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          style={getBlockStyle(block)}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {block.label}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {galleryItems.length > 0
              ? galleryItems.map((item) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={item.id}
                    src={item.url}
                    alt={item.alt || block.content.label}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ))
              : Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
                  >
                    Gallery
                  </div>
                ))}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function renderBlock(
  blockId: string,
  layout: TemplateLayout,
  contentValues: Record<string, TemplateContentValue> | undefined,
  postTitle: string | undefined,
): ReactNode {
  const block = layout.blocks[blockId];
  if (!block) {
    return null;
  }

  if (block.kind === "column" || block.kind === "container") {
    return (
      <div
        key={block.id}
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4"
        style={{ ...getBlockStyle(block), ...getContainerStyle(block) }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {block.label}
          </p>
          <span className="text-xs text-slate-400">{block.kind}</span>
        </div>
        {block.children.length > 0 ? (
          block.children.map((childId) => renderBlock(childId, layout, contentValues, postTitle))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
            Drop child blocks here in the full editor
          </div>
        )}
      </div>
    );
  }

  return <div key={block.id}>{renderLeafBlock(block, contentValues, postTitle)}</div>;
}

export default function TemplateCanvasPreview({
  layout,
  contentValues,
  postTitle,
}: TemplateCanvasPreviewProps) {
  return (
    <div
      className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
      style={{
        width: "100%",
        maxWidth: layout.canvas.width,
        minHeight: layout.canvas.minRowHeight,
        backgroundColor: layout.canvas.backgroundColor ?? "#ffffff",
      }}
    >
      <div className="flex flex-col gap-4">
        {layout.rootBlockIds.length > 0 ? (
          layout.rootBlockIds.map((blockId) =>
            renderBlock(blockId, layout, contentValues, postTitle),
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
            Add blocks to start building this template
          </div>
        )}
      </div>
    </div>
  );
}

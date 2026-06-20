"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import RichTextContent from "@/components/rte/RichTextContent";
import { createTemplateBlock } from "@/lib/template-defaults";
import {
  canReceiveChildren,
  getChildBlockIds,
  insertBlockAt,
  moveBlockToPosition,
  updateBlockSize,
} from "@/lib/template-layout";
import type {
  TemplateBlock,
  TemplateBlockKind,
  TemplateBlockSize,
  TemplateBlockStyle,
  TemplateLayout,
  TemplateSpacing,
  TemplateTextAlign,
  TemplateWidthMode,
} from "@/lib/template-schema";

const PALETTE_BLOCKS: { kind: TemplateBlockKind; label: string; hint: string }[] = [
  { kind: "title", label: "Title", hint: "Hero headline" },
  { kind: "richText", label: "Text", hint: "Body copy" },
  { kind: "image", label: "Image", hint: "Feature media" },
  { kind: "gallery", label: "Gallery", hint: "Image grid" },
  { kind: "column", label: "Columns", hint: "Side-by-side" },
  { kind: "container", label: "Stack", hint: "Section group" },
];

type DragData =
  | { type: "palette"; kind: TemplateBlockKind }
  | { type: "block"; blockId: string; parentId: string | null }
  | { type: "drop-zone"; parentId: string | null; index: number };

interface TemplateCanvasEditorProps {
  layout: TemplateLayout;
  selectedBlockId: string | null;
  onLayoutChange: (layout: TemplateLayout) => void;
  onSelectBlock: (blockId: string | null) => void;
  onUpdateBlockLabel: (blockId: string, label: string) => void;
  onUpdateBlockProps: (blockId: string, nextProps: Record<string, unknown> | undefined) => void;
  onUpdateBlockSize: (
    blockId: string,
    currentSize: TemplateBlockSize | undefined,
    field: keyof TemplateBlockSize,
    value?: number | TemplateWidthMode,
  ) => void;
  onUpdateBlockStyle: (
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: keyof TemplateBlockStyle,
    value?: number | string | TemplateTextAlign,
  ) => void;
  onUpdateBlockSpacing: (
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: "padding" | "margin",
    side: keyof TemplateSpacing,
    value?: number,
  ) => void;
  onRemoveBlock: (blockId: string) => void;
}

interface PaletteButtonProps {
  kind: TemplateBlockKind;
  label: string;
  hint: string;
}

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeState {
  blockId: string;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startMinHeight: number;
}

function PaletteButton({ kind, label, hint }: PaletteButtonProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${kind}`,
    data: {
      type: "palette",
      kind,
    } satisfies DragData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex min-w-[120px] flex-col rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
    >
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-1 text-xs text-slate-500">{hint}</span>
    </button>
  );
}

function DropZone({
  id,
  parentId,
  index,
  axis = "vertical",
  className,
}: {
  id: string;
  parentId: string | null;
  index: number;
  axis?: "vertical" | "horizontal";
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: "drop-zone",
      parentId,
      index,
    } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={
        className ??
        (axis === "horizontal"
          ? `w-5 shrink-0 rounded-full transition-colors ${isOver ? "bg-sky-400/70" : "bg-transparent"}`
          : `h-5 rounded-full transition-colors ${isOver ? "bg-sky-400/70" : "bg-transparent"}`)
      }
    />
  );
}

function toSpacingValue(spacing?: TemplateSpacing) {
  if (!spacing) {
    return undefined;
  }

  return `${spacing.top ?? 0}px ${spacing.right ?? 0}px ${spacing.bottom ?? 0}px ${spacing.left ?? 0}px`;
}

function getBlockStyle(block: TemplateBlock) {
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
    minWidth: 0,
    boxSizing: "border-box",
  };

  if (block.size?.widthMode === "full") {
    style.width = "100%";
  } else if (block.size?.widthMode === "fixed" && block.size.widthValue) {
    style.width = `${block.size.widthValue}px`;
  } else if (block.size?.widthMode === "fraction" && block.size.widthValue) {
    style.width = `${block.size.widthValue}%`;
  }

  return style;
}

function getPreviewText(block: TemplateBlock) {
  if ("content" in block) {
    return block.content.label;
  }

  return block.kind === "column" ? "Drop blocks side-by-side here" : "Drop blocks here";
}

function getColumnCount(block: Extract<TemplateBlock, { kind: "column" }>) {
  return Math.max(block.props?.columns ?? 2, 1);
}

function getPreferredBlockWidth(block: TemplateBlock, canvasWidth: number) {
  if (block.size?.widthMode === "fixed" && block.size.widthValue) {
    return block.size.widthValue;
  }

  if (block.size?.widthMode === "fraction" && block.size.widthValue) {
    return (canvasWidth * block.size.widthValue) / 100;
  }

  if (block.size?.widthMode === "full") {
    return canvasWidth;
  }

  if (block.size?.maxWidth) {
    return block.size.maxWidth;
  }

  switch (block.kind) {
    case "title":
      return 720;
    case "richText":
      return 680;
    case "image":
      return 420;
    case "gallery":
      return 520;
    case "column":
      return 640;
    case "container":
      return 560;
  }
}

function getBlockColumnSpan(
  block: TemplateBlock,
  parentBlock: TemplateBlock | undefined,
) {
  const parentColumnCount =
    parentBlock?.kind === "column" ? getColumnCount(parentBlock) : undefined;

  if (!parentColumnCount) {
    return 1;
  }

  return Math.max(1, Math.min(block.size?.columnSpan ?? 1, parentColumnCount));
}

function getColumnTrackWidths(
  block: Extract<TemplateBlock, { kind: "column" }>,
  layout: TemplateLayout,
): number[] {
  const columnCount = getColumnCount(block);
  const trackWidths = new Array<number>(columnCount).fill(180);

  // Simulate grid auto-placement (left to right, wrap to next row)
  let cursor = 0;

  for (const childId of block.children) {
    const childBlock = layout.blocks[childId];
    if (!childBlock) {
      continue;
    }

    const childSpan = getBlockColumnSpan(childBlock, block);

    // Wrap to next row if child doesn't fit in remaining tracks
    if (cursor + childSpan > columnCount) {
      cursor = 0;
    }

    const childWidth = getPreferredBlockWidth(childBlock, layout.canvas.width);
    const widthPerTrack = childWidth / childSpan;

    for (let i = 0; i < childSpan; i++) {
      const trackIndex = cursor + i;
      if (trackIndex < columnCount) {
        trackWidths[trackIndex] = Math.max(trackWidths[trackIndex], widthPerTrack);
      }
    }

    cursor += childSpan;
    if (cursor >= columnCount) {
      cursor = 0;
    }
  }

  return trackWidths;
}

interface ColumnBlockLayout {
  style: CSSProperties;
  gridTemplateColumns: string;
}

function getColumnBlockLayout(
  block: Extract<TemplateBlock, { kind: "column" }>,
  layout: TemplateLayout,
): ColumnBlockLayout {
  const columnCount = getColumnCount(block);
  const gap = block.style?.gap ?? 16;

  const blockPadding = block.style?.padding;
  const horizontalPadding = blockPadding
    ? (blockPadding.left ?? 0) + (blockPadding.right ?? 0)
    : 0;

  // The column inner wrapper has p-5 (20px) on each side plus ~1px border,
  // which reduces the space available for the grid tracks. Account for this
  // so the outer width grows enough for children to fit without overflow.
  const innerChrome = 2 * 20 + 2 * 1;

  const trackWidths = getColumnTrackWidths(block, layout);
  const gridWidth = trackWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(columnCount - 1, 0);
  const preferredWidth = gridWidth + innerChrome + horizontalPadding;

  return {
    style: {
      width: `min(100%, ${Math.min(preferredWidth, layout.canvas.width)}px)`,
      maxWidth: "100%",
    },
    gridTemplateColumns: trackWidths.map((w) => `minmax(0, ${w}fr)`).join(" "),
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

interface CanvasBlockProps {
  layout: TemplateLayout;
  blockId: string;
  parentId: string | null;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onResizeStart: (blockId: string, direction: ResizeDirection, event: ReactPointerEvent<HTMLDivElement>) => void;
  menuBlockId: string | null;
  onToggleBlockMenu: (blockId: string) => void;
  onCloseBlockMenu: () => void;
  onUpdateBlockLabel: (blockId: string, label: string) => void;
  onUpdateBlockProps: (blockId: string, nextProps: Record<string, unknown> | undefined) => void;
  onUpdateBlockSize: (
    blockId: string,
    currentSize: TemplateBlockSize | undefined,
    field: keyof TemplateBlockSize,
    value?: number | TemplateWidthMode,
  ) => void;
  onUpdateBlockStyle: (
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: keyof TemplateBlockStyle,
    value?: number | string | TemplateTextAlign,
  ) => void;
  onUpdateBlockSpacing: (
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: "padding" | "margin",
    side: keyof TemplateSpacing,
    value?: number,
  ) => void;
  onRemoveBlock: (blockId: string) => void;
}

function CanvasBlock({
  layout,
  blockId,
  parentId,
  selectedBlockId,
  onSelectBlock,
  onResizeStart,
  menuBlockId,
  onToggleBlockMenu,
  onCloseBlockMenu,
  onUpdateBlockLabel,
  onUpdateBlockProps,
  onUpdateBlockSize,
  onUpdateBlockStyle,
  onUpdateBlockSpacing,
  onRemoveBlock,
}: CanvasBlockProps) {
  const block = layout.blocks[blockId];
  const isSelected = selectedBlockId === blockId;
  const isMenuOpen = menuBlockId === blockId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block-${blockId}`,
    data: {
      type: "block",
      blockId,
      parentId,
    } satisfies DragData,
  });

  if (!block) {
    return null;
  }

  const childIds = canReceiveChildren(block) ? getChildBlockIds(layout, block.id) : [];
  const axis = block.kind === "column" ? "horizontal" : "vertical";
  const slotCount = block.kind === "column" ? getColumnCount(block) : 0;
  const columnLayout = block.kind === "column" ? getColumnBlockLayout(block, layout) : null;
  const parentBlock = parentId ? layout.blocks[parentId] : undefined;
  const blockColumnSpan = getBlockColumnSpan(block, parentBlock);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        ...(parentBlock?.kind === "column"
          ? { gridColumn: `span ${blockColumnSpan} / span ${blockColumnSpan}` }
          : {}),
      }}
      className="relative"
    >
      <div
        className={`group relative flex flex-col overflow-visible rounded-[28px] transition ${
          isSelected
            ? "cursor-grab ring-2 ring-sky-400/70 ring-offset-4 ring-offset-[#f5efe5]"
            : "hover:ring-1 hover:ring-slate-300/80 hover:ring-offset-2 hover:ring-offset-[#f5efe5]"
        }`}
        style={{
          ...getBlockStyle(block),
          ...(columnLayout ? columnLayout.style : {}),
          ...(parentBlock?.kind === "column" ? { maxWidth: "100%" } : {}),
        }}
        {...(isSelected ? attributes : {})}
        {...(isSelected ? listeners : {})}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelectBlock(block.id);
          if (isSelected) {
            listeners?.onPointerDown?.(event);
          }
        }}
      >
        <div
          className={`absolute right-3 top-3 z-20 flex items-center gap-2 transition ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelectBlock(block.id);
              onToggleBlockMenu(block.id);
            }}
            className={`rounded-full border px-2.5 py-1 text-sm font-semibold shadow-sm ${
              isMenuOpen
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-white/95 text-slate-600"
            }`}
            aria-label={`Open ${block.label} menu`}
            aria-expanded={isMenuOpen}
          >
            ...
          </button>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm">
            {block.kind}
          </span>
        </div>

        {isMenuOpen ? (
          <div
            className="absolute right-3 top-14 z-30 w-[320px] max-w-[calc(100vw-3rem)]"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <BlockInspector
              block={block}
              parentBlock={parentBlock}
              onUpdateBlockLabel={onUpdateBlockLabel}
              onUpdateBlockProps={onUpdateBlockProps}
              onUpdateBlockSize={onUpdateBlockSize}
              onUpdateBlockStyle={onUpdateBlockStyle}
              onUpdateBlockSpacing={onUpdateBlockSpacing}
              onRemoveBlock={onRemoveBlock}
              onCloseBlockMenu={onCloseBlockMenu}
            />
          </div>
        ) : null}

        {"content" in block ? (
          <LeafBlockPreview block={block} />
        ) : block.kind === "column" ? (
          <div className="rounded-[28px] border border-slate-200/80 bg-[#fbfaf8] p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{block.label}</p>
                <p className="text-xs text-slate-500">Arrange content in parallel columns.</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                {slotCount} columns
              </div>
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: columnLayout?.gridTemplateColumns ?? `repeat(${slotCount}, minmax(0, 1fr))`,
                gridAutoFlow: "row dense",
                gridAutoRows: "min-content",
                alignContent: "start",
                columnGap: `${block.style?.gap ?? 16}px`,
                rowGap: "8px",
              }}
            >
              <DropZone
                id={`drop-${block.id}-0`}
                parentId={block.id}
                index={0}
                axis="vertical"
                className="col-span-full h-2 rounded-full transition-colors"
              />
              {childIds.length > 0 ? (
                childIds.map((childId, index) => (
                  <Fragment key={`fragment-${childId}`}>
                    <CanvasBlock
                      layout={layout}
                      blockId={childId}
                      parentId={block.id}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={onSelectBlock}
                      onResizeStart={onResizeStart}
                      menuBlockId={menuBlockId}
                      onToggleBlockMenu={onToggleBlockMenu}
                      onCloseBlockMenu={onCloseBlockMenu}
                      onUpdateBlockLabel={onUpdateBlockLabel}
                      onUpdateBlockProps={onUpdateBlockProps}
                      onUpdateBlockSize={onUpdateBlockSize}
                      onUpdateBlockStyle={onUpdateBlockStyle}
                      onUpdateBlockSpacing={onUpdateBlockSpacing}
                      onRemoveBlock={onRemoveBlock}
                    />
                    <DropZone
                      id={`drop-${block.id}-${index + 1}`}
                      parentId={block.id}
                      index={index + 1}
                      axis="vertical"
                      className="col-span-full h-2 rounded-full transition-colors"
                    />
                  </Fragment>
                ))
              ) : (
                <div className="col-span-full flex min-h-[180px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm text-slate-400">
                  Drop a block into this grid and adjust its span from the component menu.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-slate-200/80 bg-[#fbfaf8] p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{block.label}</p>
                <p className="text-xs text-slate-500">Stack sections vertically to shape the page.</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                {childIds.length} items
              </div>
            </div>
            <div className={axis === "horizontal" ? "flex items-stretch gap-4" : "space-y-4"}>
              <DropZone id={`drop-${block.id}-0`} parentId={block.id} index={0} axis={axis} />
              {childIds.length > 0 ? (
                childIds.map((childId, index) => (
                  <Fragment key={`fragment-${childId}`}>
                    <CanvasBlock
                      layout={layout}
                      blockId={childId}
                      parentId={block.id}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={onSelectBlock}
                      onResizeStart={onResizeStart}
                      menuBlockId={menuBlockId}
                      onToggleBlockMenu={onToggleBlockMenu}
                      onCloseBlockMenu={onCloseBlockMenu}
                      onUpdateBlockLabel={onUpdateBlockLabel}
                      onUpdateBlockProps={onUpdateBlockProps}
                      onUpdateBlockSize={onUpdateBlockSize}
                      onUpdateBlockStyle={onUpdateBlockStyle}
                      onUpdateBlockSpacing={onUpdateBlockSpacing}
                      onRemoveBlock={onRemoveBlock}
                    />
                    <DropZone
                      id={`drop-${block.id}-${index + 1}`}
                      parentId={block.id}
                      index={index + 1}
                      axis={axis}
                    />
                  </Fragment>
                ))
              ) : (
                <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm text-slate-400">
                  {getPreviewText(block)}
                </div>
              )}
            </div>
          </div>
        )}

        {isSelected ? (
          <>
            {/* Edge handles */}
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "n", event)}
              className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "s", event)}
              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "w", event)}
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "e", event)}
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
            />
            {/* Corner handles */}
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "nw", event)}
              className="absolute left-0 top-0 h-3 w-3 cursor-nwse-resize"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "ne", event)}
              className="absolute right-0 top-0 h-3 w-3 cursor-nesw-resize"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "sw", event)}
              className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, "se", event)}
              className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function LeafBlockPreview({ block }: { block: TemplateBlock }) {
  switch (block.kind) {
    case "title":
      return (
        <div className="flex-1 rounded-[28px] bg-white px-6 py-8 md:px-10 md:py-12">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            Story Header
          </p>
          <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950 md:text-5xl">
            {block.content.label}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
            A short deck or summary would sit here to introduce the story.
          </p>
        </div>
      );
    case "richText":
      return (
        <div className="flex-1 rounded-[28px] bg-white px-6 py-8 md:px-10 md:py-10">
          <div className="prose prose-slate max-w-none">
            <RichTextContent
              content={JSON.stringify({
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "This block previews the main body copy, including spacing and readable line length on the final page.",
                      },
                    ],
                  },
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Select the block to adjust its width, spacing, and presentation without leaving the page canvas.",
                      },
                    ],
                  },
                ],
              })}
              className="text-base leading-8 text-slate-700"
            />
          </div>
        </div>
      );
    case "image":
      return (
        <div className="flex-1 rounded-[28px] bg-white p-5 md:p-6">
          <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_50%,#f59e0b_100%)]">
            <div className="flex aspect-[16/9] items-end bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_45%)] p-6">
              <p className="max-w-xs text-sm font-medium text-white/90">{block.content.label}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Feature image slot with room for a caption or credit.
          </p>
        </div>
      );
    case "gallery":
      return (
        <div className="flex-1 rounded-[28px] bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{block.label}</p>
              <p className="text-xs text-slate-500">Collection of supporting images</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              3-up grid
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-[22px] bg-[linear-gradient(145deg,#e2e8f0_0%,#cbd5e1_40%,#f8fafc_100%)]"
              />
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function BlockInspector({
  block,
  parentBlock,
  onUpdateBlockLabel,
  onUpdateBlockProps,
  onUpdateBlockSize,
  onUpdateBlockStyle,
  onUpdateBlockSpacing,
  onRemoveBlock,
  onCloseBlockMenu,
}: {
  block: TemplateBlock;
  parentBlock: TemplateBlock | undefined;
  onUpdateBlockLabel: (blockId: string, label: string) => void;
  onUpdateBlockProps: (blockId: string, nextProps: Record<string, unknown> | undefined) => void;
  onUpdateBlockSize: (
    blockId: string,
    currentSize: TemplateBlockSize | undefined,
    field: keyof TemplateBlockSize,
    value?: number | TemplateWidthMode,
  ) => void;
  onUpdateBlockStyle: (
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: keyof TemplateBlockStyle,
    value?: number | string | TemplateTextAlign,
  ) => void;
  onUpdateBlockSpacing: (
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: "padding" | "margin",
    side: keyof TemplateSpacing,
    value?: number,
  ) => void;
  onRemoveBlock: (blockId: string) => void;
  onCloseBlockMenu: () => void;
}) {
  const parentColumnCount = parentBlock?.kind === "column" ? getColumnCount(parentBlock) : null;

  return (
    <aside className="rounded-[28px] border border-slate-200 bg-white/98 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Component Menu
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{block.label}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Edit this block without leaving the page view.
          </p>
        </div>

        <button
          type="button"
          onClick={onCloseBlockMenu}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Label
          </span>
          <input
            type="text"
            value={block.label}
            onChange={(event) => onUpdateBlockLabel(block.id, event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </label>

        {"content" in block ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Content key: <span className="font-mono text-slate-900">{block.content.key}</span>
          </div>
        ) : null}

        {block.kind === "column" ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Number of Columns
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={block.props?.columns ?? 2}
              onChange={(event) =>
                onUpdateBlockProps(block.id, {
                  ...(block.props ?? {}),
                  columns: parseOptionalNumber(event.target.value) ?? 1,
                })
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
        ) : null}

        {parentColumnCount ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Column Span
            </span>
            <input
              type="number"
              min={1}
              max={parentColumnCount}
              value={getBlockColumnSpan(block, parentBlock)}
              onChange={(event) =>
                onUpdateBlockSize(
                  block.id,
                  block.size,
                  "columnSpan",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <p className="text-xs text-slate-500">
              This item can span up to {parentColumnCount} columns in its parent grid.
            </p>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Width Mode
            </span>
            <select
              value={block.size?.widthMode ?? ""}
              onChange={(event) =>
                onUpdateBlockSize(
                  block.id,
                  block.size,
                  "widthMode",
                  (event.target.value || undefined) as TemplateWidthMode | undefined,
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">Auto</option>
              <option value="full">Full Width</option>
              <option value="fixed">Fixed Pixels</option>
              <option value="fraction">Percentage</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              {block.size?.widthMode === "fraction" ? "Width %" : "Width Value"}
            </span>
            <input
              type="number"
              min={1}
              max={block.size?.widthMode === "fraction" ? 100 : undefined}
              value={block.size?.widthValue ?? ""}
              onChange={(event) =>
                onUpdateBlockSize(
                  block.id,
                  block.size,
                  "widthValue",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder={block.size?.widthMode === "fraction" ? "50" : "320"}
            />
          </label>
        </div>

        {parentColumnCount ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Wider values here ask the parent grid to grow until it reaches the page limit. After
            that, the grid compresses to fit the viewport.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Min Height
            </span>
            <input
              type="number"
              min={1}
              value={block.size?.minHeight ?? ""}
              onChange={(event) =>
                onUpdateBlockSize(
                  block.id,
                  block.size,
                  "minHeight",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="180"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Max Width
            </span>
            <input
              type="number"
              min={1}
              value={block.size?.maxWidth ?? ""}
              onChange={(event) =>
                onUpdateBlockSize(
                  block.id,
                  block.size,
                  "maxWidth",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="720"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Gap
            </span>
            <input
              type="number"
              min={0}
              value={block.style?.gap ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "gap",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="16"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Text Align
            </span>
            <select
              value={block.style?.textAlign ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "textAlign",
                  (event.target.value || undefined) as TemplateTextAlign | undefined,
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">Default</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Background
            </span>
            <input
              type="text"
              value={block.style?.backgroundColor ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "backgroundColor",
                  event.target.value || undefined,
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="#ffffff"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Text Color
            </span>
            <input
              type="text"
              value={block.style?.textColor ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "textColor",
                  event.target.value || undefined,
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="#0f172a"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Radius
            </span>
            <input
              type="number"
              min={0}
              value={block.style?.borderRadius ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "borderRadius",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="24"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Border
            </span>
            <input
              type="number"
              min={0}
              value={block.style?.borderWidth ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "borderWidth",
                  parseOptionalNumber(event.target.value),
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="1"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Border Color
            </span>
            <input
              type="text"
              value={block.style?.borderColor ?? ""}
              onChange={(event) =>
                onUpdateBlockStyle(
                  block.id,
                  block.style,
                  "borderColor",
                  event.target.value || undefined,
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="#cbd5e1"
            />
          </label>
        </div>

        <SpacingEditor
          label="Padding"
          spacing={block.style?.padding}
          onChange={(side, value) =>
            onUpdateBlockSpacing(block.id, block.style, "padding", side, value)
          }
        />

        <SpacingEditor
          label="Margin"
          spacing={block.style?.margin}
          onChange={(side, value) =>
            onUpdateBlockSpacing(block.id, block.style, "margin", side, value)
          }
        />

        <button
          type="button"
          onClick={() => {
            onCloseBlockMenu();
            onRemoveBlock(block.id);
          }}
          className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Remove Component
        </button>
      </div>
    </aside>
  );
}

function SpacingEditor({
  label,
  spacing,
  onChange,
}: {
  label: string;
  spacing?: TemplateSpacing;
  onChange: (side: keyof TemplateSpacing, value?: number) => void;
}) {
  const fields: Array<{ key: keyof TemplateSpacing; label: string }> = [
    { key: "top", label: "Top" },
    { key: "right", label: "Right" },
    { key: "bottom", label: "Bottom" },
    { key: "left", label: "Left" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <label key={field.key} className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-500">{field.label}</span>
            <input
              type="number"
              min={0}
              value={spacing?.[field.key] ?? ""}
              onChange={(event) => onChange(field.key, parseOptionalNumber(event.target.value))}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="0"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function TemplateCanvasEditor({
  layout,
  selectedBlockId,
  onLayoutChange,
  onSelectBlock,
  onUpdateBlockLabel,
  onUpdateBlockProps,
  onUpdateBlockSize,
  onUpdateBlockStyle,
  onUpdateBlockSpacing,
  onRemoveBlock,
}: TemplateCanvasEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);

  const selectedBlock = selectedBlockId ? layout.blocks[selectedBlockId] : null;

  useEffect(() => {
    if (!resizeState) {
      return undefined;
    }

    const activeResizeState = resizeState;

    function handlePointerMove(event: PointerEvent) {
      const dir = activeResizeState.direction;
      const dx = event.clientX - activeResizeState.startX;
      const dy = event.clientY - activeResizeState.startY;

      const resizesWidth = dir === "e" || dir === "w" || dir === "ne" || dir === "nw" || dir === "se" || dir === "sw";
      const resizesHeight = dir === "n" || dir === "s" || dir === "ne" || dir === "nw" || dir === "se" || dir === "sw";

      // Left/west edges grow width when mouse moves left (negative dx)
      const widthDelta = dir.includes("w") ? -dx : dx;
      // Top/north edges grow height when mouse moves up (negative dy)
      const heightDelta = dir.includes("n") ? -dy : dy;

      const currentSize = layout.blocks[activeResizeState.blockId]?.size ?? {};
      const nextSize = { ...currentSize };

      if (resizesWidth) {
        nextSize.widthMode = "fixed";
        nextSize.widthValue = Math.max(160, activeResizeState.startWidth + widthDelta);
      }

      if (resizesHeight) {
        nextSize.minHeight = Math.max(120, activeResizeState.startMinHeight + heightDelta);
      }

      onLayoutChange(updateBlockSize(layout, activeResizeState.blockId, nextSize));
    }

    function handlePointerUp() {
      setResizeState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [layout, onLayoutChange, resizeState]);

  function handleDragStart(event: DragStartEvent) {
    setMenuBlockId(null);
    setActiveDragData((event.active.data.current as DragData | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = (event.active.data.current as DragData | undefined) ?? null;
    const overData = (event.over?.data.current as DragData | undefined) ?? null;
    setActiveDragData(null);

    if (!activeData || !overData || overData.type !== "drop-zone") {
      return;
    }

    if (activeData.type === "palette") {
      const block = createTemplateBlock(activeData.kind);
      onLayoutChange(insertBlockAt(layout, block, overData.parentId, overData.index));
      onSelectBlock(block.id);
      return;
    }

    if (activeData.type === "block") {
      onLayoutChange(
        moveBlockToPosition(
          layout,
          activeData.blockId,
          activeData.parentId,
          overData.parentId,
          overData.index,
        ),
      );
      onSelectBlock(activeData.blockId);
    }
  }

  function handleResizeStart(blockId: string, direction: ResizeDirection, event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const block = layout.blocks[blockId];
    setResizeState({
      blockId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth:
        block.size?.widthMode === "fixed" ? block.size.widthValue ?? 320 : block.size?.maxWidth ?? 320,
      startMinHeight: block.size?.minHeight ?? 180,
    });
  }

  function handleToggleBlockMenu(blockId: string) {
    setMenuBlockId((currentMenuBlockId) => (currentMenuBlockId === blockId ? null : blockId));
  }

  function handleCloseBlockMenu() {
    setMenuBlockId(null);
  }

  const overlayLabel = useMemo(() => {
    if (!activeDragData) {
      return null;
    }

    if (activeDragData.type === "palette") {
      return PALETTE_BLOCKS.find((block) => block.kind === activeDragData.kind)?.label ?? "Block";
    }

    if (activeDragData.type === "block") {
      return layout.blocks[activeDragData.blockId]?.label ?? "Block";
    }

    return null;
  }, [activeDragData, layout.blocks]);

  return (
    <div className="relative rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_45%,#eff6ff_100%)] p-4 shadow-sm md:p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Page Builder
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Drag components onto the page and click any block to open its contextual menu.
                </p>
              </div>
              {selectedBlock ? (
                <div
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
                  aria-label={`Selected component: ${selectedBlock.label}`}
                >
                  Editing {selectedBlock.label}
                </div>
              ) : (
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                  No component selected
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {PALETTE_BLOCKS.map((block) => (
                <PaletteButton
                  key={block.kind}
                  kind={block.kind}
                  label={block.label}
                  hint={block.hint}
                />
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="rounded-[32px] border border-slate-200 bg-[#eae3d6] p-3 shadow-inner md:p-5"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  onSelectBlock(null);
                  handleCloseBlockMenu();
                }
              }}
            >
              <div className="rounded-[28px] border border-slate-300/80 bg-[#f5efe5] p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-4">
                <div className="mb-3 overflow-hidden rounded-[22px] border border-slate-300 bg-[#dbe3ea] shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-300 bg-[linear-gradient(180deg,#edf2f7_0%,#d7e0e8_100%)] px-4 py-2.5">
                    <div className="h-3 w-16 rounded-sm bg-slate-200" />
                    <div className="rounded-md border border-slate-400/50 bg-slate-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600">
                      Preview Window
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-3 w-3 rounded-sm border border-slate-500/40 bg-slate-100" />
                      <span className="inline-flex h-3 w-3 rounded-sm border border-slate-500/40 bg-slate-100" />
                      <span className="inline-flex h-3 w-3 rounded-sm border border-slate-500/40 bg-slate-100" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-[#eef3f7] px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="text-sm">◀</span>
                      <span className="text-sm">▶</span>
                      <span className="text-sm">↻</span>
                    </div>
                    <div className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs text-slate-500 shadow-inner">
                      preview://story-template
                    </div>
                    <div className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-500">
                      Page
                    </div>
                  </div>
                </div>

                <div
                  className="mx-auto overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]"
                  style={{
                    width: "100%",
                    maxWidth: layout.canvas.width,
                    minHeight: Math.max(layout.canvas.minRowHeight, 720),
                    backgroundColor: layout.canvas.backgroundColor ?? "#ffffff",
                  }}
                >
                  <div className="border-b border-slate-200 px-6 py-5 md:px-10">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                          Site Header
                        </p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">The Field Notes</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                        <span>Stories</span>
                        <span>Guides</span>
                        <span>Photo Essays</span>
                        <span>About</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[linear-gradient(180deg,#fdfdfc_0%,#faf7f2_100%)] px-4 py-6 md:px-8 md:py-8">
                    <div className="space-y-5">
                      <DropZone id="drop-root-0" parentId={null} index={0} />
                      {layout.rootBlockIds.length > 0 ? (
                        layout.rootBlockIds.map((blockId, index) => (
                          <Fragment key={`root-${blockId}`}>
                            <CanvasBlock
                              layout={layout}
                              blockId={blockId}
                              parentId={null}
                              selectedBlockId={selectedBlockId}
                              onSelectBlock={onSelectBlock}
                              onResizeStart={handleResizeStart}
                              menuBlockId={menuBlockId}
                              onToggleBlockMenu={handleToggleBlockMenu}
                              onCloseBlockMenu={handleCloseBlockMenu}
                              onUpdateBlockLabel={onUpdateBlockLabel}
                              onUpdateBlockProps={onUpdateBlockProps}
                              onUpdateBlockSize={onUpdateBlockSize}
                              onUpdateBlockStyle={onUpdateBlockStyle}
                              onUpdateBlockSpacing={onUpdateBlockSpacing}
                              onRemoveBlock={onRemoveBlock}
                            />
                            <DropZone id={`drop-root-${index + 1}`} parentId={null} index={index + 1} />
                          </Fragment>
                        ))
                      ) : (
                        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/75 px-6 py-20 text-center text-base text-slate-400">
                          Start with a blank page. Drag a component here and build the story flow
                          directly on the canvas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {overlayLabel ? (
            <div className="rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-xl">
              {overlayLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

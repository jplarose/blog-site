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
import { Fragment, useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

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
  TemplateLayout,
} from "@/lib/template-schema";

const PALETTE_BLOCKS: { kind: TemplateBlockKind; label: string }[] = [
  { kind: "title", label: "Title" },
  { kind: "richText", label: "Text" },
  { kind: "image", label: "Image" },
  { kind: "gallery", label: "Gallery" },
  { kind: "column", label: "Columns" },
  { kind: "container", label: "Stack" },
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
}

interface PaletteButtonProps {
  kind: TemplateBlockKind;
  label: string;
}

interface ResizeState {
  blockId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startMinHeight: number;
}

function PaletteButton({ kind, label }: PaletteButtonProps) {
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
      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
    >
      {label}
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
          ? `w-4 shrink-0 rounded-full transition-colors ${isOver ? "bg-indigo-500" : "bg-transparent"}`
          : `h-4 rounded-full transition-colors ${isOver ? "bg-indigo-500" : "bg-transparent"}`)
      }
    />
  );
}

function SlotDropZone({
  parentId,
  index,
  children,
}: {
  parentId: string;
  index: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${parentId}-${index}`,
    data: {
      type: "drop-zone",
      parentId,
      index,
    } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[180px] flex-1 rounded-2xl border transition ${
        isOver ? "border-indigo-400 bg-indigo-50/80" : "border-slate-200 bg-white/70"
      }`}
    >
      {children}
    </div>
  );
}

function toSpacingValue(spacing: TemplateBlock["style"] extends { padding?: infer T } ? T : never) {
  if (!spacing || typeof spacing !== "object") {
    return undefined;
  }

  const value = spacing as { top?: number; right?: number; bottom?: number; left?: number };
  return `${value.top ?? 0}px ${value.right ?? 0}px ${value.bottom ?? 0}px ${value.left ?? 0}px`;
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

interface CanvasBlockProps {
  layout: TemplateLayout;
  blockId: string;
  parentId: string | null;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onResizeStart: (blockId: string, event: ReactPointerEvent<HTMLDivElement>) => void;
}

function CanvasBlock({
  layout,
  blockId,
  parentId,
  selectedBlockId,
  onSelectBlock,
  onResizeStart,
}: CanvasBlockProps) {
  const block = layout.blocks[blockId];
  const isSelected = selectedBlockId === blockId;

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
  const slotCount =
    block.kind === "column" ? Math.max(block.props?.columns ?? 2, childIds.length, 2) : 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
      }}
      className="relative"
    >
      <div
        className={`relative rounded-3xl border bg-white shadow-sm transition ${
          isSelected ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"
        }`}
        style={getBlockStyle(block)}
        onPointerDown={() => onSelectBlock(block.id)}
      >
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 shadow-sm"
          >
            Move
          </button>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            {block.kind}
          </span>
          {isSelected ? (
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-indigo-700">
              {Math.round(block.size?.widthMode === "fixed" ? block.size.widthValue ?? 320 : block.size?.maxWidth ?? 320)}w
              {" · "}
              {Math.round(block.size?.minHeight ?? 180)}h
            </span>
          ) : null}
        </div>

        {"content" in block ? (
          <LeafBlockPreview block={block} />
        ) : block.kind === "column" ? (
          <div className="rounded-3xl bg-slate-50/90 p-6 pt-14">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">{block.label}</div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                {slotCount} columns
              </div>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
              {Array.from({ length: slotCount }).map((_, slotIndex) => {
                const childId = childIds[slotIndex];

                return (
                  <SlotDropZone key={`slot-${block.id}-${slotIndex}`} parentId={block.id} index={slotIndex}>
                    {childId ? (
                      <div className="h-full p-2">
                        <CanvasBlock
                          layout={layout}
                          blockId={childId}
                          parentId={block.id}
                          selectedBlockId={selectedBlockId}
                          onSelectBlock={onSelectBlock}
                          onResizeStart={onResizeStart}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                        Drop a block in this column
                      </div>
                    )}
                  </SlotDropZone>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-50/90 p-6 pt-14">
            <div className="mb-4 text-sm font-semibold text-slate-700">{block.label}</div>
            <div className={axis === "horizontal" ? "flex items-stretch gap-3" : "space-y-3"}>
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
                <div className="flex min-h-[140px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-8 text-center text-sm text-slate-400">
                  {getPreviewText(block)}
                </div>
              )}
            </div>
          </div>
        )}

        {isSelected ? (
          <>
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, event)}
              className="absolute inset-y-10 right-0 w-3 cursor-ew-resize rounded-full bg-gradient-to-r from-transparent via-indigo-200 to-indigo-400 opacity-80"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, event)}
              className="absolute inset-x-10 bottom-0 h-3 cursor-ns-resize rounded-full bg-gradient-to-b from-transparent via-indigo-200 to-indigo-400 opacity-80"
            />
            <div
              role="presentation"
              onPointerDown={(event) => onResizeStart(block.id, event)}
              className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize rounded-bl-xl rounded-tr-3xl bg-indigo-500 shadow-lg"
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
        <div className="rounded-3xl bg-white p-6 pt-14">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{block.label}</p>
          <h2 className="text-4xl font-semibold text-slate-900">{block.content.label}</h2>
        </div>
      );
    case "richText":
      return (
        <div className="rounded-3xl bg-white p-6 pt-14">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{block.label}</p>
          <RichTextContent
            content={JSON.stringify({
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Text content preview" }] }],
            })}
            className="text-sm leading-7 text-slate-600"
          />
        </div>
      );
    case "image":
      return (
        <div className="rounded-3xl bg-white p-6 pt-14">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{block.label}</p>
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
            Image
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="rounded-3xl bg-white p-6 pt-14">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{block.label}</p>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
              >
                Gallery
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function TemplateCanvasEditor({
  layout,
  selectedBlockId,
  onLayoutChange,
  onSelectBlock,
}: TemplateCanvasEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  const selectedBlock = selectedBlockId ? layout.blocks[selectedBlockId] : null;

  useEffect(() => {
    if (!resizeState) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const nextWidth = Math.max(160, resizeState.startWidth + (event.clientX - resizeState.startX));
      const nextMinHeight = Math.max(120, resizeState.startMinHeight + (event.clientY - resizeState.startY));

      onLayoutChange(
        updateBlockSize(layout, resizeState.blockId, {
          ...(layout.blocks[resizeState.blockId]?.size ?? {}),
          widthMode: "fixed",
          widthValue: nextWidth,
          minHeight: nextMinHeight,
        }),
      );
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

  function handleResizeStart(blockId: string, event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const block = layout.blocks[blockId];
    setResizeState({
      blockId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: block.size?.widthMode === "fixed" ? block.size.widthValue ?? 320 : block.size?.maxWidth ?? 320,
      startMinHeight: block.size?.minHeight ?? 180,
    });
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
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Components</p>
            <p className="text-sm text-slate-600">Drag blocks directly onto the page.</p>
          </div>
          {selectedBlock ? (
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Selected: {selectedBlock.label}
            </div>
          ) : null}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            {PALETTE_BLOCKS.map((block) => (
              <PaletteButton key={block.kind} kind={block.kind} label={block.label} />
            ))}
          </div>

          <div
            className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6 shadow-inner"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                onSelectBlock(null);
              }
            }}
          >
            <div
              className="mx-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg"
              style={{
                width: "100%",
                maxWidth: layout.canvas.width,
                minHeight: Math.max(layout.canvas.minRowHeight, 720),
                backgroundColor: layout.canvas.backgroundColor ?? "#ffffff",
              }}
            >
              <div className="space-y-4">
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
                      />
                      <DropZone id={`drop-root-${index + 1}`} parentId={null} index={index + 1} />
                    </Fragment>
                  ))
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-20 text-center text-base text-slate-400">
                    Start with a blank page. Drag a component here and place it where it should live.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DragOverlay>
            {overlayLabel ? (
              <div className="rounded-2xl border border-indigo-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-xl">
                {overlayLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

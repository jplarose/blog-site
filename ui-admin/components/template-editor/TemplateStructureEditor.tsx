"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  canReceiveChildren,
  getChildBlockIds,
  moveBlock,
  removeBlock,
  updateBlockLabel,
} from "@/lib/template-layout";
import type { TemplateLayout } from "@/lib/template-schema";

interface TemplateStructureEditorProps {
  layout: TemplateLayout;
  selectedParentId: string | null;
  selectedBlockId: string | null;
  onLayoutChange: (layout: TemplateLayout) => void;
  onSelectParent: (parentId: string | null) => void;
  onSelectBlock: (blockId: string | null) => void;
}

interface SortableBlockRowProps extends TemplateStructureEditorProps {
  blockId: string;
  parentId: string | null;
  depth: number;
}

function DropZone({
  id,
  parentId,
  depth,
  label,
}: {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: "container-zone",
      parentId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ marginLeft: depth * 16 }}
      className={`rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
        isOver
          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
          : "border-gray-300 bg-gray-50 text-gray-500"
      }`}
    >
      {label}
    </div>
  );
}

function SortableBlockRow(props: SortableBlockRowProps) {
  const { layout, blockId, parentId, depth, selectedParentId, onLayoutChange, onSelectParent } =
    props;
  const block = layout.blocks[blockId];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blockId,
    data: {
      parentId,
    },
  });

  if (!block) {
    return null;
  }

  const childIds = canReceiveChildren(block) ? getChildBlockIds(layout, block.id) : [];

  const isSelected = props.selectedBlockId === blockId;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="space-y-2"
    >
      <div
        className={`rounded-lg border bg-white p-3 shadow-sm transition-colors ${
          isSelected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 active:cursor-grabbing"
              aria-label={`Drag ${block.label}`}
            >
              Drag
            </button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                {block.kind}
              </p>
              <button
                type="button"
                onClick={() => props.onSelectBlock(block.id)}
                className="text-left text-sm font-medium text-gray-900 hover:text-indigo-700"
              >
                {block.label}
              </button>
            </div>
          </div>

          <div className="flex gap-1">
            {canReceiveChildren(block) ? (
              <button
                type="button"
                onClick={() => onSelectParent(block.id)}
                className={`rounded border px-2 py-1 text-xs ${
                  selectedParentId === block.id
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                Insert Here
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onLayoutChange(removeBlock(layout, block.id))}
              className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600"
            >
              Remove
            </button>
          </div>
        </div>

        <input
          type="text"
          value={block.label}
          onChange={(event) =>
            onLayoutChange(updateBlockLabel(layout, block.id, event.target.value))
          }
          onFocus={() => props.onSelectBlock(block.id)}
          className="mt-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        {"content" in block ? (
          <p className="mt-2 text-xs text-gray-500">
            Content slot: <span className="font-mono">{block.content.key}</span>
          </p>
        ) : null}
      </div>

      {canReceiveChildren(block) ? (
        <div style={{ marginLeft: depth * 16 + 16 }}>
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
              <DropZone
                id={`drop-zone-${block.id}`}
                parentId={block.id}
                depth={0}
                label={
                  childIds.length > 0
                    ? "Drop here to append to this container"
                    : "Drop here or select “Insert Here” to add the first child"
                }
              />
              {childIds.length > 0 ? (
                childIds.map((childId) => (
                  <SortableBlockRow
                    key={childId}
                    {...props}
                    blockId={childId}
                    parentId={block.id}
                    depth={depth + 1}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-500">
                  Empty container. Select “Insert Here” and add a block from the palette.
                </p>
              )}
            </div>
          </SortableContext>
        </div>
      ) : null}
    </div>
  );
}

export default function TemplateStructureEditor(props: TemplateStructureEditorProps) {
  const { layout, onLayoutChange } = props;
  const rootBlockIds = layout.rootBlockIds;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const activeParentId = (active.data.current?.parentId as string | null | undefined) ?? null;
    const overType = over.data.current?.type as string | undefined;
    const overParentId = (over.data.current?.parentId as string | null | undefined) ?? null;
    const overId = overType === "container-zone" ? null : String(over.id);

    onLayoutChange(
      moveBlock(layout, String(active.id), overId, activeParentId, overParentId),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">Insert Target</p>
          <p className="text-sm text-gray-700">
            {props.selectedParentId
              ? layout.blocks[props.selectedParentId]?.label ?? "Selected container"
              : "Root canvas"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => props.onSelectParent(null)}
          className={`rounded border px-2 py-1 text-xs ${
            props.selectedParentId === null
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-gray-300 text-gray-600"
          }`}
        >
          Insert At Root
        </button>
      </div>

      {props.selectedBlockId ? (
        <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
          <p className="text-sm text-indigo-800">
            Selected block: <span className="font-medium">{layout.blocks[props.selectedBlockId]?.label ?? "Unknown"}</span>
          </p>
          <button
            type="button"
            onClick={() => props.onSelectBlock(null)}
            className="rounded border border-indigo-200 px-2 py-1 text-xs text-indigo-700"
          >
            Clear Selection
          </button>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rootBlockIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            <DropZone
              id="drop-zone-root"
              parentId={null}
              depth={0}
              label={
                rootBlockIds.length > 0
                  ? "Drop here to append to the root canvas"
                  : "Add blocks from the palette or drop them here to start the template structure."
              }
            />
            {rootBlockIds.length > 0 ? (
              rootBlockIds.map((blockId) => (
                <SortableBlockRow
                  key={blockId}
                  {...props}
                  blockId={blockId}
                  parentId={null}
                  depth={0}
                />
              ))
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-center text-sm text-gray-500">
                Blocks added at the root will appear here.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

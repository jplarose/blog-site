"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
  onLayoutChange: (layout: TemplateLayout) => void;
  onSelectParent: (parentId: string | null) => void;
}

interface SortableBlockRowProps extends TemplateStructureEditorProps {
  blockId: string;
  parentId: string | null;
  depth: number;
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
        className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
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
              <p className="text-sm font-medium text-gray-900">{block.label}</p>
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
    const overParentId = (over.data.current?.parentId as string | null | undefined) ?? null;

    onLayoutChange(
      moveBlock(layout, String(active.id), String(over.id), activeParentId, overParentId),
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rootBlockIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
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
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                Add blocks from the palette to start the template structure.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

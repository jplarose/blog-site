import { arrayMove } from "@dnd-kit/sortable";

import type {
  ColumnTemplateBlock,
  ContainerTemplateBlock,
  GalleryTemplateBlock,
  ImageTemplateBlock,
  TemplateBlockSize,
  TemplateBlockStyle,
  TemplateBlock,
  TemplateLayout,
  TitleTemplateBlock,
  RichTextTemplateBlock,
} from "@/lib/template-schema";

type TemplateContainerBlock = ColumnTemplateBlock | ContainerTemplateBlock;
export type TemplateContentBlock =
  | TitleTemplateBlock
  | RichTextTemplateBlock
  | ImageTemplateBlock
  | GalleryTemplateBlock;

export function canReceiveChildren(
  block: TemplateBlock | undefined,
): block is TemplateContainerBlock {
  return block?.kind === "column" || block?.kind === "container";
}

export function getChildBlockIds(layout: TemplateLayout, parentId: string | null): string[] {
  if (!parentId) {
    return layout.rootBlockIds;
  }

  const parent = layout.blocks[parentId];
  if (!parent || !canReceiveChildren(parent)) {
    return [];
  }

  return parent.children;
}

export function insertBlock(
  layout: TemplateLayout,
  block: TemplateBlock,
  parentId: string | null = null,
): TemplateLayout {
  return insertBlockAt(layout, block, parentId, getChildBlockIds(layout, parentId).length);
}

export function insertBlockAt(
  layout: TemplateLayout,
  block: TemplateBlock,
  parentId: string | null,
  index: number,
): TemplateLayout {
  const siblings = getChildBlockIds(layout, parentId);
  const nextIndex = Math.max(0, Math.min(index, siblings.length));

  if (parentId) {
    const parent = layout.blocks[parentId];
    if (!parent || !canReceiveChildren(parent)) {
      return layout;
    }

    const nextChildren = [...parent.children];
    nextChildren.splice(nextIndex, 0, block.id);

    return {
      ...layout,
      blocks: {
        ...layout.blocks,
        [parentId]: {
          ...parent,
          children: nextChildren,
        },
        [block.id]: {
          ...block,
          parentId,
        },
      },
    };
  }

  const nextRootBlockIds = [...layout.rootBlockIds];
  nextRootBlockIds.splice(nextIndex, 0, block.id);

  return {
    ...layout,
    rootBlockIds: nextRootBlockIds,
    blocks: {
      ...layout.blocks,
      [block.id]: {
        ...block,
        parentId: null,
      },
    },
  };
}

export function moveBlockToPosition(
  layout: TemplateLayout,
  activeId: string,
  activeParentId: string | null,
  targetParentId: string | null,
  targetIndex: number,
): TemplateLayout {
  const activeSiblings = getChildBlockIds(layout, activeParentId);
  const activeIndex = activeSiblings.indexOf(activeId);

  if (activeIndex === -1) {
    return layout;
  }

  const nextActiveSiblings = activeSiblings.filter((id) => id !== activeId);
  let nextLayout = updateParentChildren(layout, activeParentId, nextActiveSiblings);

  const targetSiblings = getChildBlockIds(nextLayout, targetParentId);
  const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetSiblings.length));
  const nextTargetSiblings = [...targetSiblings];
  nextTargetSiblings.splice(normalizedTargetIndex, 0, activeId);

  nextLayout = updateParentChildren(nextLayout, targetParentId, nextTargetSiblings);

  return {
    ...nextLayout,
    blocks: {
      ...nextLayout.blocks,
      [activeId]: {
        ...nextLayout.blocks[activeId],
        parentId: targetParentId,
      },
    },
  };
}

export function getContentBlocksInOrder(layout: TemplateLayout): TemplateContentBlock[] {
  const blocks: TemplateContentBlock[] = [];

  for (const rootBlockId of layout.rootBlockIds) {
    collectContentBlocks(layout, rootBlockId, blocks);
  }

  return blocks;
}

export function moveBlock(
  layout: TemplateLayout,
  activeId: string,
  overId: string | null,
  activeParentId: string | null,
  overParentId: string | null,
): TemplateLayout {
  const activeSiblings = getChildBlockIds(layout, activeParentId);
  const overSiblings = getChildBlockIds(layout, overParentId);
  const activeIndex = activeSiblings.indexOf(activeId);

  if (activeIndex === -1) {
    return layout;
  }

  const overIndex = overId ? overSiblings.indexOf(overId) : overSiblings.length;

  if (overId && overIndex === -1) {
    return layout;
  }

  if (activeParentId === overParentId) {
    const nextSiblings = arrayMove(activeSiblings, activeIndex, overIndex);
    return updateParentChildren(layout, activeParentId, nextSiblings);
  }

  return moveBlockToPosition(layout, activeId, activeParentId, overParentId, overIndex);
}

export function updateBlockLabel(
  layout: TemplateLayout,
  blockId: string,
  label: string,
): TemplateLayout {
  const block = layout.blocks[blockId];
  if (!block) {
    return layout;
  }

  let nextBlock: TemplateBlock;

  switch (block.kind) {
    case "title":
      nextBlock = {
        ...block,
        label,
        content: {
          ...block.content,
          label,
        },
      };
      break;
    case "richText":
      nextBlock = {
        ...block,
        label,
        content: {
          ...block.content,
          label,
        },
      };
      break;
    case "image":
      nextBlock = {
        ...block,
        label,
        content: {
          ...block.content,
          label,
        },
      };
      break;
    case "gallery":
      nextBlock = {
        ...block,
        label,
        content: {
          ...block.content,
          label,
        },
      };
      break;
    case "column":
    case "container":
      nextBlock = {
        ...block,
        label,
      };
      break;
  }

  return {
    ...layout,
    blocks: {
      ...layout.blocks,
      [blockId]: nextBlock,
    },
  };
}

export function updateBlockSize(
  layout: TemplateLayout,
  blockId: string,
  nextSize: TemplateBlockSize,
): TemplateLayout {
  const block = layout.blocks[blockId];
  if (!block) {
    return layout;
  }

  const normalizedSize = normalizeBlockSize(nextSize);

  return {
    ...layout,
    blocks: {
      ...layout.blocks,
      [blockId]: {
        ...block,
        size: normalizedSize,
      },
    },
  };
}

export function updateBlockStyle(
  layout: TemplateLayout,
  blockId: string,
  nextStyle: TemplateBlockStyle,
): TemplateLayout {
  const block = layout.blocks[blockId];
  if (!block) {
    return layout;
  }

  const normalizedStyle = normalizeBlockStyle(nextStyle);

  return {
    ...layout,
    blocks: {
      ...layout.blocks,
      [blockId]: {
        ...block,
        style: normalizedStyle,
      },
    },
  };
}

export function removeBlock(layout: TemplateLayout, blockId: string): TemplateLayout {
  const block = layout.blocks[blockId];
  if (!block) {
    return layout;
  }

  const idsToRemove = new Set<string>();
  collectDescendants(layout, blockId, idsToRemove);

  const nextBlocks = { ...layout.blocks };
  for (const id of idsToRemove) {
    delete nextBlocks[id];
  }

  const parentId = block.parentId ?? null;
  const nextSiblings = getChildBlockIds(layout, parentId).filter((id) => id !== blockId);
  const nextLayout = updateParentChildren(
    {
      ...layout,
      blocks: nextBlocks,
    },
    parentId,
    nextSiblings,
  );

  return nextLayout;
}

function collectDescendants(
  layout: TemplateLayout,
  blockId: string,
  idsToRemove: Set<string>,
) {
  idsToRemove.add(blockId);
  const block = layout.blocks[blockId];
  if (!block || !canReceiveChildren(block)) {
    return;
  }

  for (const childId of block.children) {
    collectDescendants(layout, childId, idsToRemove);
  }
}

function collectContentBlocks(
  layout: TemplateLayout,
  blockId: string,
  blocks: TemplateContentBlock[],
) {
  const block = layout.blocks[blockId];
  if (!block) {
    return;
  }

  if (
    block.kind === "title" ||
    block.kind === "richText" ||
    block.kind === "image" ||
    block.kind === "gallery"
  ) {
    blocks.push(block);
    return;
  }

  for (const childId of block.children) {
    collectContentBlocks(layout, childId, blocks);
  }
}

function updateParentChildren(
  layout: TemplateLayout,
  parentId: string | null,
  childIds: string[],
): TemplateLayout {
  if (!parentId) {
    return {
      ...layout,
      rootBlockIds: childIds,
    };
  }

  const parent = layout.blocks[parentId];
  if (!parent || !canReceiveChildren(parent)) {
    return layout;
  }

  return {
    ...layout,
    blocks: {
      ...layout.blocks,
      [parentId]: {
        ...parent,
        children: childIds,
      },
    },
  };
}

function normalizeBlockSize(size: TemplateBlockSize): TemplateBlockSize | undefined {
  const normalizedSize: TemplateBlockSize = {};

  if (size.widthMode) {
    normalizedSize.widthMode = size.widthMode;
  }

  if (typeof size.widthValue === "number" && Number.isFinite(size.widthValue) && size.widthValue > 0) {
    normalizedSize.widthValue = size.widthValue;
  }

  if (typeof size.minHeight === "number" && Number.isFinite(size.minHeight) && size.minHeight > 0) {
    normalizedSize.minHeight = size.minHeight;
  }

  if (typeof size.maxWidth === "number" && Number.isFinite(size.maxWidth) && size.maxWidth > 0) {
    normalizedSize.maxWidth = size.maxWidth;
  }

  return Object.keys(normalizedSize).length > 0 ? normalizedSize : undefined;
}

function normalizeBlockStyle(style: TemplateBlockStyle): TemplateBlockStyle | undefined {
  const normalizedStyle: TemplateBlockStyle = {};

  if (typeof style.gap === "number" && Number.isFinite(style.gap) && style.gap >= 0) {
    normalizedStyle.gap = style.gap;
  }

  if (style.backgroundColor?.trim()) {
    normalizedStyle.backgroundColor = style.backgroundColor.trim();
  }

  if (style.textColor?.trim()) {
    normalizedStyle.textColor = style.textColor.trim();
  }

  if (style.textAlign) {
    normalizedStyle.textAlign = style.textAlign;
  }

  if (typeof style.borderRadius === "number" && Number.isFinite(style.borderRadius) && style.borderRadius >= 0) {
    normalizedStyle.borderRadius = style.borderRadius;
  }

  if (style.borderColor?.trim()) {
    normalizedStyle.borderColor = style.borderColor.trim();
  }

  if (typeof style.borderWidth === "number" && Number.isFinite(style.borderWidth) && style.borderWidth >= 0) {
    normalizedStyle.borderWidth = style.borderWidth;
  }

  if (style.padding) {
    const padding = normalizeSpacing(style.padding);
    if (padding) {
      normalizedStyle.padding = padding;
    }
  }

  if (style.margin) {
    const margin = normalizeSpacing(style.margin);
    if (margin) {
      normalizedStyle.margin = margin;
    }
  }

  return Object.keys(normalizedStyle).length > 0 ? normalizedStyle : undefined;
}

function normalizeSpacing(spacing: NonNullable<TemplateBlockStyle["padding"]>) {
  const normalizedSpacing = {
    top: normalizeOptionalSpacing(spacing.top),
    right: normalizeOptionalSpacing(spacing.right),
    bottom: normalizeOptionalSpacing(spacing.bottom),
    left: normalizeOptionalSpacing(spacing.left),
  };

  return Object.values(normalizedSpacing).some((value) => value !== undefined)
    ? normalizedSpacing
    : undefined;
}

function normalizeOptionalSpacing(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

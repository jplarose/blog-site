import { arrayMove } from "@dnd-kit/sortable";

import type {
  ColumnTemplateBlock,
  ContainerTemplateBlock,
  TemplateBlock,
  TemplateLayout,
} from "@/lib/template-schema";

type TemplateContainerBlock = ColumnTemplateBlock | ContainerTemplateBlock;

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
  if (parentId) {
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
          children: [...parent.children, block.id],
        },
        [block.id]: {
          ...block,
          parentId,
        },
      },
    };
  }

  return {
    ...layout,
    rootBlockIds: [...layout.rootBlockIds, block.id],
    blocks: {
      ...layout.blocks,
      [block.id]: {
        ...block,
        parentId: null,
      },
    },
  };
}

export function moveBlock(
  layout: TemplateLayout,
  activeId: string,
  overId: string,
  activeParentId: string | null,
  overParentId: string | null,
): TemplateLayout {
  const activeSiblings = getChildBlockIds(layout, activeParentId);
  const overSiblings = getChildBlockIds(layout, overParentId);
  const activeIndex = activeSiblings.indexOf(activeId);
  const overIndex = overSiblings.indexOf(overId);

  if (activeIndex === -1 || overIndex === -1) {
    return layout;
  }

  if (activeParentId === overParentId) {
    const nextSiblings = arrayMove(activeSiblings, activeIndex, overIndex);
    return updateParentChildren(layout, activeParentId, nextSiblings);
  }

  const nextActiveSiblings = activeSiblings.filter((id) => id !== activeId);
  const nextOverSiblings = [...overSiblings];
  nextOverSiblings.splice(overIndex, 0, activeId);

  let nextLayout = updateParentChildren(layout, activeParentId, nextActiveSiblings);
  nextLayout = updateParentChildren(nextLayout, overParentId, nextOverSiblings);

  return {
    ...nextLayout,
    blocks: {
      ...nextLayout.blocks,
      [activeId]: {
        ...nextLayout.blocks[activeId],
        parentId: overParentId,
      },
    },
  };
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

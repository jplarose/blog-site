import { describe, expect, it } from "vitest";

import { getContentBlocksInOrder, insertBlock, moveBlock } from "@/lib/template-layout";
import type { TemplateLayout } from "@/lib/template-schema";

function createLayout(): TemplateLayout {
  return {
    version: 1,
    canvas: {
      width: 960,
      minRowHeight: 160,
      backgroundColor: "#ffffff",
    },
    rootBlockIds: ["container-a", "title-b"],
    blocks: {
      "container-a": {
        id: "container-a",
        kind: "container",
        label: "Container A",
        parentId: null,
        children: ["rich-text-a", "image-a"],
        props: { direction: "column" },
      },
      "rich-text-a": {
        id: "rich-text-a",
        kind: "richText",
        label: "Body",
        parentId: "container-a",
        content: {
          key: "body",
          kind: "richText",
          label: "Body",
        },
      },
      "image-a": {
        id: "image-a",
        kind: "image",
        label: "Hero",
        parentId: "container-a",
        content: {
          key: "hero",
          kind: "image",
          label: "Hero",
        },
      },
      "title-b": {
        id: "title-b",
        kind: "title",
        label: "Title",
        parentId: null,
        content: {
          key: "title",
          kind: "plainText",
          label: "Title",
        },
      },
    },
  };
}

describe("template-layout helpers", () => {
  it("returns content blocks in saved traversal order", () => {
    const layout = createLayout();

    expect(getContentBlocksInOrder(layout).map((block) => block.id)).toEqual([
      "rich-text-a",
      "image-a",
      "title-b",
    ]);
  });

  it("preserves deterministic order after json roundtrip", () => {
    const layout = createLayout();
    const reloadedLayout = JSON.parse(JSON.stringify(layout)) as TemplateLayout;

    expect(getContentBlocksInOrder(reloadedLayout).map((block) => block.content.key)).toEqual([
      "body",
      "hero",
      "title",
    ]);
  });

  it("moves a block between parents without changing block identity", () => {
    const layout = createLayout();
    const insertedLayout = insertBlock(
      layout,
      {
        id: "container-b",
        kind: "container",
        label: "Container B",
        parentId: null,
        children: [],
        props: { direction: "column" },
      },
      null,
    );

    const movedLayout = moveBlock(
      insertedLayout,
      "image-a",
      "title-b",
      "container-a",
      null,
    );

    expect(movedLayout.blocks["image-a"]?.parentId).toBeNull();
    expect(movedLayout.rootBlockIds).toContain("image-a");
    expect(movedLayout.blocks["container-a"]?.kind).toBe("container");
  });
});

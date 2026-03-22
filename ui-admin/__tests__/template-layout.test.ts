import { describe, expect, it } from "vitest";

import {
  getContentBlocksInOrder,
  insertBlock,
  insertBlockAt,
  moveBlock,
  moveBlockToPosition,
  updateBlockSize,
  updateBlockStyle,
} from "@/lib/template-layout";
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

  it("appends a block into an empty container drop zone", () => {
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
      "title-b",
      null,
      null,
      "container-b",
    );

    expect(movedLayout.blocks["title-b"]?.parentId).toBe("container-b");
    expect(movedLayout.blocks["container-b"]?.kind).toBe("container");
    expect(movedLayout.blocks["container-b"]?.children).toEqual(["title-b"]);
    expect(movedLayout.rootBlockIds).toEqual(["container-a", "container-b"]);
  });

  it("appends a nested block back to the root drop zone", () => {
    const layout = createLayout();

    const movedLayout = moveBlock(
      layout,
      "image-a",
      null,
      "container-a",
      null,
    );

    expect(movedLayout.blocks["image-a"]?.parentId).toBeNull();
    expect(movedLayout.rootBlockIds).toEqual(["container-a", "title-b", "image-a"]);
    expect(movedLayout.blocks["container-a"]?.children).toEqual(["rich-text-a"]);
  });

  it("stores explicit block sizing values for preview rendering", () => {
    const layout = createLayout();

    const sizedLayout = updateBlockSize(layout, "title-b", {
      widthMode: "fixed",
      widthValue: 480,
      minHeight: 220,
      maxWidth: 640,
    });

    expect(sizedLayout.blocks["title-b"]?.size).toEqual({
      widthMode: "fixed",
      widthValue: 480,
      minHeight: 220,
      maxWidth: 640,
    });
  });

  it("removes empty sizing values instead of persisting invalid numbers", () => {
    const layout = createLayout();

    const sizedLayout = updateBlockSize(layout, "title-b", {
      widthMode: "fraction",
      widthValue: 0,
      minHeight: -20,
      maxWidth: Number.NaN,
    });

    expect(sizedLayout.blocks["title-b"]?.size).toEqual({
      widthMode: "fraction",
    });
  });

  it("inserts a new block at the hovered root position", () => {
    const layout = createLayout();

    const nextLayout = insertBlockAt(
      layout,
      {
        id: "gallery-new",
        kind: "gallery",
        label: "Gallery",
        content: {
          key: "gallery_new",
          kind: "gallery",
          label: "Gallery",
        },
      },
      null,
      1,
    );

    expect(nextLayout.rootBlockIds).toEqual(["container-a", "gallery-new", "title-b"]);
    expect(nextLayout.blocks["gallery-new"]?.parentId).toBeNull();
  });

  it("moves an existing block to an explicit index in a row container", () => {
    const layout = createLayout();

    const withColumn = insertBlock(
      layout,
      {
        id: "column-a",
        kind: "column",
        label: "Columns",
        parentId: null,
        children: ["card-left", "card-right"],
        props: { direction: "row", columns: 2 },
      },
      null,
    );

    const withChildren = {
      ...withColumn,
      blocks: {
        ...withColumn.blocks,
        "card-left": {
          id: "card-left",
          kind: "image",
          label: "Left",
          parentId: "column-a",
          content: {
            key: "left",
            kind: "image",
            label: "Left",
          },
        },
        "card-right": {
          id: "card-right",
          kind: "richText",
          label: "Right",
          parentId: "column-a",
          content: {
            key: "right",
            kind: "richText",
            label: "Right",
          },
        },
      },
    } satisfies TemplateLayout;

    const movedLayout = moveBlockToPosition(withChildren, "title-b", null, "column-a", 1);

    expect(movedLayout.rootBlockIds).toEqual(["container-a", "column-a"]);
    expect(movedLayout.blocks["title-b"]?.parentId).toBe("column-a");
    expect(movedLayout.blocks["column-a"]?.kind).toBe("column");
    expect(movedLayout.blocks["column-a"]?.children).toEqual(["card-left", "title-b", "card-right"]);
  });

  it("normalizes style controls before persisting them", () => {
    const layout = createLayout();

    const styledLayout = updateBlockStyle(layout, "title-b", {
      gap: 24,
      backgroundColor: " #ffffff ",
      textColor: "#111827",
      textAlign: "center",
      borderRadius: 20,
      borderWidth: 2,
      borderColor: "#cbd5e1",
      padding: {
        top: 12,
        right: 16,
        bottom: 12,
        left: 16,
      },
    });

    expect(styledLayout.blocks["title-b"]?.style).toEqual({
      gap: 24,
      backgroundColor: "#ffffff",
      textColor: "#111827",
      textAlign: "center",
      borderRadius: 20,
      borderWidth: 2,
      borderColor: "#cbd5e1",
      padding: {
        top: 12,
        right: 16,
        bottom: 12,
        left: 16,
      },
    });
  });

  it("drops invalid spacing values while preserving valid padding and margin edges", () => {
    const layout = createLayout();

    const styledLayout = updateBlockStyle(layout, "title-b", {
      padding: {
        top: 12,
        right: -4,
        bottom: 18,
        left: Number.NaN,
      },
      margin: {
        top: 0,
        right: 24,
        bottom: undefined,
        left: 8,
      },
    });

    expect(styledLayout.blocks["title-b"]?.style).toEqual({
      padding: {
        top: 12,
        right: undefined,
        bottom: 18,
        left: undefined,
      },
      margin: {
        top: 0,
        right: 24,
        bottom: undefined,
        left: 8,
      },
    });
  });

  it("drops into the expected right-hand slot of a column block", () => {
    const layout = createLayout();
    const withColumn = insertBlock(
      layout,
      {
        id: "column-b",
        kind: "column",
        label: "Columns",
        parentId: null,
        children: ["image-left"],
        props: { direction: "row", columns: 2 },
      },
      null,
    );

    const withLeftImage = {
      ...withColumn,
      blocks: {
        ...withColumn.blocks,
        "image-left": {
          id: "image-left",
          kind: "image",
          label: "Image Left",
          parentId: "column-b",
          content: {
            key: "image_left",
            kind: "image",
            label: "Image Left",
          },
        },
      },
    } satisfies TemplateLayout;

    const movedLayout = moveBlockToPosition(withLeftImage, "title-b", null, "column-b", 1);

    expect(movedLayout.blocks["column-b"]?.kind).toBe("column");
    expect(movedLayout.blocks["column-b"]?.children).toEqual(["image-left", "title-b"]);
  });
});

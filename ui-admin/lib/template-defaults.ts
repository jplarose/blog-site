import type {
  ColumnTemplateBlock,
  ContainerTemplateBlock,
  TemplateBlock,
  TemplateBlockKind,
  TemplateLayout,
} from "@/lib/template-schema";

export function createEmptyTemplateLayout(): TemplateLayout {
  return {
    version: 1,
    canvas: {
      width: 960,
      minRowHeight: 160,
      backgroundColor: "#ffffff",
    },
    rootBlockIds: [],
    blocks: {},
  };
}

export function createTemplateBlock(kind: TemplateBlockKind): TemplateBlock {
  const id = crypto.randomUUID();

  switch (kind) {
    case "title":
      return {
        id,
        kind,
        label: "Title",
        content: {
          key: `title_${id}`,
          kind: "plainText",
          label: "Post title",
          required: true,
        },
      };
    case "richText":
      return {
        id,
        kind,
        label: "Rich Text",
        content: {
          key: `rich_text_${id}`,
          kind: "richText",
          label: "Body content",
          required: true,
        },
      };
    case "image":
      return {
        id,
        kind,
        label: "Image",
        content: {
          key: `image_${id}`,
          kind: "image",
          label: "Feature image",
        },
        props: {
          fit: "cover",
        },
      };
    case "gallery":
      return {
        id,
        kind,
        label: "Gallery",
        content: {
          key: `gallery_${id}`,
          kind: "gallery",
          label: "Gallery images",
          minItems: 1,
        },
        props: {
          columns: 3,
          showCaptions: true,
        },
      };
    case "column":
      return createContainerBlock(id, "Columns", "row", kind);
    case "container":
      return createContainerBlock(id, "Container", "column", kind);
  }
}

function createContainerBlock(
  id: string,
  label: string,
  direction: "row" | "column",
  kind: "column" | "container",
): ColumnTemplateBlock | ContainerTemplateBlock {
  return {
    id,
    kind,
    label,
    children: [],
    props: {
      direction,
      ...(kind === "column" ? { columns: 2 } : {}),
    },
    style: {
      gap: 16,
    },
  };
}

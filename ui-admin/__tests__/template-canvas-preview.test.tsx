import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TemplateCanvasPreview from "@/components/template-editor/TemplateCanvasPreview";
import type { TemplateLayout } from "@/lib/template-schema";

const layout: TemplateLayout = {
  version: 1,
  canvas: {
    width: 960,
    minRowHeight: 160,
    backgroundColor: "#ffffff",
  },
  rootBlockIds: ["title-1", "rich-1", "image-1", "gallery-1"],
  blocks: {
    "title-1": {
      id: "title-1",
      kind: "title",
      label: "Title",
      parentId: null,
      content: {
        key: "title",
        kind: "plainText",
        label: "Post title",
      },
      props: {
        headingLevel: 1,
      },
    },
    "rich-1": {
      id: "rich-1",
      kind: "richText",
      label: "Body",
      parentId: null,
      content: {
        key: "body",
        kind: "richText",
        label: "Body",
      },
    },
    "image-1": {
      id: "image-1",
      kind: "image",
      label: "Hero",
      parentId: null,
      content: {
        key: "hero",
        kind: "image",
        label: "Hero",
      },
    },
    "gallery-1": {
      id: "gallery-1",
      kind: "gallery",
      label: "Gallery",
      parentId: null,
      content: {
        key: "gallery",
        kind: "gallery",
        label: "Gallery",
      },
      props: {
        columns: 3,
        showCaptions: true,
      },
    },
  },
};

describe("TemplateCanvasPreview", () => {
  it("renders saved layout with bound content values", () => {
    render(
      <TemplateCanvasPreview
        layout={layout}
        postTitle="Bound Title"
        contentValues={{
          body: JSON.stringify({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Rendered body copy" }],
              },
            ],
          }),
          hero: {
            url: "https://example.com/hero.jpg",
            alt: "Hero alt",
            caption: "Hero caption",
          },
          gallery: [
            { id: "g1", url: "https://example.com/one.jpg", alt: "One" },
            { id: "g2", url: "https://example.com/two.jpg", alt: "Two" },
          ],
        }}
      />,
    );

    expect(screen.getByText("Bound Title")).toBeInTheDocument();
    expect(screen.getByText("Rendered body copy")).toBeInTheDocument();
    expect(screen.getByText("Hero caption")).toBeInTheDocument();
    expect(screen.getByAltText("Hero alt")).toBeInTheDocument();
    expect(screen.getByAltText("One")).toBeInTheDocument();
    expect(screen.getByAltText("Two")).toBeInTheDocument();
  });

  it("renders the same output after layout reload", () => {
    const reloadedLayout = JSON.parse(JSON.stringify(layout)) as TemplateLayout;

    const { rerender } = render(
      <TemplateCanvasPreview layout={layout} postTitle="Stable Title" contentValues={{}} />,
    );

    expect(screen.getByText("Stable Title")).toBeInTheDocument();

    rerender(
      <TemplateCanvasPreview
        layout={reloadedLayout}
        postTitle="Stable Title"
        contentValues={{}}
      />,
    );

    expect(screen.getByText("Stable Title")).toBeInTheDocument();
    expect(screen.getByText("Enter content for this block in the template-aware editor.")).toBeInTheDocument();
  });

  it("renders column children with their configured grid span", () => {
    const gridLayout: TemplateLayout = {
      version: 1,
      canvas: {
        width: 960,
        minRowHeight: 160,
        backgroundColor: "#ffffff",
      },
      rootBlockIds: ["column-1"],
      blocks: {
        "column-1": {
          id: "column-1",
          kind: "column",
          label: "Columns",
          parentId: null,
          children: ["rich-span", "image-side"],
          props: {
            direction: "row",
            columns: 3,
          },
        },
        "rich-span": {
          id: "rich-span",
          kind: "richText",
          label: "Feature Text",
          parentId: "column-1",
          size: {
            columnSpan: 2,
          },
          content: {
            key: "feature_body",
            kind: "richText",
            label: "Feature body",
          },
        },
        "image-side": {
          id: "image-side",
          kind: "image",
          label: "Side Image",
          parentId: "column-1",
          content: {
            key: "side_image",
            kind: "image",
            label: "Side image",
          },
        },
      },
    };

    render(<TemplateCanvasPreview layout={gridLayout} contentValues={{}} />);

    expect(screen.getByText("Feature Text").parentElement?.parentElement).toHaveStyle({
      gridColumn: "span 2 / span 2",
    });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import TemplateCanvasEditor from "@/components/template-editor/TemplateCanvasEditor";
import type { TemplateLayout } from "@/lib/template-schema";

const nestedLayout: TemplateLayout = {
  version: 1,
  canvas: {
    width: 960,
    minRowHeight: 160,
    backgroundColor: "#ffffff",
  },
  rootBlockIds: ["container-1"],
  blocks: {
    "container-1": {
      id: "container-1",
      kind: "container",
      label: "Stack",
      parentId: null,
      children: ["rich-1"],
      props: {
        direction: "column",
      },
    },
    "rich-1": {
      id: "rich-1",
      kind: "richText",
      label: "Body",
      parentId: "container-1",
      content: {
        key: "body",
        kind: "richText",
        label: "Body copy",
      },
    },
  },
};

describe("TemplateCanvasEditor", () => {
  it("selects a nested block when clicking inside it", () => {
    function StatefulHarness() {
      const [selectedBlockId, setSelectedBlockId] = useState<string | null>("container-1");

      return (
        <TemplateCanvasEditor
          layout={nestedLayout}
          selectedBlockId={selectedBlockId}
          onLayoutChange={() => undefined}
          onSelectBlock={setSelectedBlockId}
          onUpdateBlockLabel={() => undefined}
          onUpdateBlockProps={() => undefined}
          onUpdateBlockSize={() => undefined}
          onUpdateBlockStyle={() => undefined}
          onUpdateBlockSpacing={() => undefined}
          onRemoveBlock={() => undefined}
        />
      );
    }

    render(<StatefulHarness />);

    expect(screen.getByText("Editing Stack")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText(/main body copy/i));

    expect(screen.getByText("Editing Body")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open Body menu"));

    expect(screen.getByDisplayValue("Body")).toBeInTheDocument();
  });
});

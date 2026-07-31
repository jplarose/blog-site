import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TemplatePreview from "@/components/post-editor/TemplatePreview";
import type { CatalogTemplate } from "@/lib/catalog";

const template: CatalogTemplate = {
  id: 1,
  templateKey: "article",
  name: "Article",
  description: "Standard long-form post.",
  htmlStructure: "<article><h1>{{title}}</h1><div>{{content}}</div></article>",
  cssStyles: ".tpl-article { max-width: 720px; }",
};

const fields = {
  title: "Hello",
  content: "",
  excerpt: "",
  featuredImageUrl: "",
  category: "",
  tags: [],
};

describe("TemplatePreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the preview iframe fully sandboxed with no script execution allowed", () => {
    render(<TemplatePreview template={template} isLoading={false} error={null} fields={fields} />);

    const iframe = screen.getByTitle("Template preview");
    expect(iframe).toHaveAttribute("sandbox", "");
    // Guard against a future "allow-scripts" (or any allow-*) regression slipping in.
    const sandboxValue = iframe.getAttribute("sandbox") ?? "";
    expect(sandboxValue).not.toMatch(/allow-/);
  });

  it("does not render an iframe when no template is selected", () => {
    render(<TemplatePreview template={null} isLoading={false} error={null} fields={fields} />);

    expect(screen.queryByTitle("Template preview")).not.toBeInTheDocument();
    expect(screen.getByText("Select a template above to preview your post.")).toBeInTheDocument();
  });
});

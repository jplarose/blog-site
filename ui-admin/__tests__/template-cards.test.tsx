import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TemplateCards from "@/components/post-editor/TemplateCards";
import type { TemplateSummary } from "@/lib/catalog";

const templates: TemplateSummary[] = [
  { id: 1, templateKey: "article", name: "Article", description: "Standard long-form post." },
  { id: 2, templateKey: "feature", name: "Feature", description: "Editorial feature." },
  { id: 3, templateKey: "photo-essay", name: "Photo Essay", description: "Image-forward layout." },
];

describe("TemplateCards", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a card for every catalog template", () => {
    render(<TemplateCards templates={templates} selectedTemplateId="" onSelect={vi.fn()} />);

    expect(screen.getByText("Article")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();
    expect(screen.getByText("Photo Essay")).toBeInTheDocument();
  });

  it("marks the selected template's radio input as checked", () => {
    render(<TemplateCards templates={templates} selectedTemplateId="2" onSelect={vi.fn()} />);

    expect(screen.getByLabelText("Feature")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("Article")).toHaveProperty("checked", false);
  });

  it("calls onSelect with the clicked template's id", () => {
    const onSelect = vi.fn();
    render(<TemplateCards templates={templates} selectedTemplateId="" onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText("Photo Essay"));

    expect(onSelect).toHaveBeenCalledWith("3");
  });

  it("disables selection when disabled", () => {
    render(<TemplateCards templates={templates} selectedTemplateId="" onSelect={vi.fn()} disabled />);

    expect(screen.getByLabelText("Article")).toBeDisabled();
  });
});

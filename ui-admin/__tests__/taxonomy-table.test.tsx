import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TaxonomyTable, { type TaxonomyRow } from "@/components/taxonomy/TaxonomyTable";

const rows: TaxonomyRow[] = [
  { id: 1, name: "News", slug: "news", postCount: 4, description: "Daily updates" },
  { id: 2, name: "Guides", slug: "guides", postCount: 0 },
];

describe("TaxonomyTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a loading state", () => {
    render(
      <TaxonomyTable
        entityLabel="category"
        rows={[]}
        isLoading
        showDescription
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/loading categories/i)).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(
      <TaxonomyTable
        entityLabel="tag"
        rows={[]}
        isLoading={false}
        showDescription={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/no tags yet/i)).toBeInTheDocument();
  });

  it("renders a row per item with name, slug, and post count", () => {
    render(
      <TaxonomyTable
        entityLabel="category"
        rows={rows}
        isLoading={false}
        showDescription
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("news")).toBeInTheDocument();
    expect(screen.getByText("Daily updates")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Guides")).toBeInTheDocument();
  });

  it("omits the description column when showDescription is false", () => {
    render(
      <TaxonomyTable
        entityLabel="tag"
        rows={rows}
        isLoading={false}
        showDescription={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    expect(screen.queryByText("Daily updates")).not.toBeInTheDocument();
  });

  it("calls onEdit and onDelete with the row when its buttons are clicked", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TaxonomyTable
        entityLabel="category"
        rows={rows}
        isLoading={false}
        showDescription
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(onEdit).toHaveBeenCalledWith(rows[0]);

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConfirmDeleteTaxonomyDialog from "@/components/taxonomy/ConfirmDeleteTaxonomyDialog";

describe("ConfirmDeleteTaxonomyDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a plain confirmation for an unreferenced item", () => {
    render(
      <ConfirmDeleteTaxonomyDialog
        entityLabel="category"
        itemName="News"
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading")).toHaveTextContent("Delete “News”?");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a distinct in-use message built from postCount when the delete fails with a referenced conflict", () => {
    render(
      <ConfirmDeleteTaxonomyDialog
        entityLabel="tag"
        itemName="Featured"
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        referencedByPostCount={3}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/in use by 3 posts/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/reassign/i);
  });

  it("uses singular post wording when exactly one post references the item", () => {
    render(
      <ConfirmDeleteTaxonomyDialog
        entityLabel="tag"
        itemName="Featured"
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        referencedByPostCount={1}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/in use by 1 post\b/i);
  });

  it("shows a distinct generic server error when one is provided without a known post count", () => {
    render(
      <ConfirmDeleteTaxonomyDialog
        entityLabel="category"
        itemName="News"
        isSubmitting={false}
        serverError="Category cannot be deleted because it is still referenced by posts."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Category cannot be deleted because it is still referenced by posts.",
    );
  });

  it("disables buttons and shows busy label while submitting", () => {
    render(
      <ConfirmDeleteTaxonomyDialog
        entityLabel="tag"
        itemName="Featured"
        isSubmitting
        serverError={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("calls onConfirm and onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteTaxonomyDialog
        entityLabel="tag"
        itemName="Featured"
        isSubmitting={false}
        serverError={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

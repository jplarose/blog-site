import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TaxonomyFormModal from "@/components/taxonomy/TaxonomyFormModal";

describe("TaxonomyFormModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("auto-suggests a slug from the name while creating, until the slug is edited by hand", () => {
    render(
      <TaxonomyFormModal
        mode="create"
        entityLabel="category"
        initialValues={{ name: "", slug: "", description: "" }}
        showDescription
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Deep Dives" } });
    expect(screen.getByLabelText("Slug")).toHaveValue("deep-dives");

    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "custom-slug" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Deep Dives Two" } });
    expect(screen.getByLabelText("Slug")).toHaveValue("custom-slug");
  });

  it("does not auto-suggest the slug while editing an existing item", () => {
    render(
      <TaxonomyFormModal
        mode="edit"
        entityLabel="category"
        initialValues={{ name: "News", slug: "news", description: "" }}
        showDescription
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Updates" } });
    expect(screen.getByLabelText("Slug")).toHaveValue("news");
  });

  it("shows the description field only when showDescription is true", () => {
    render(
      <TaxonomyFormModal
        mode="create"
        entityLabel="tag"
        initialValues={{ name: "", slug: "" }}
        showDescription={false}
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });

  it("submits trimmed name, slug, and description", () => {
    const onSubmit = vi.fn();
    render(
      <TaxonomyFormModal
        mode="create"
        entityLabel="category"
        initialValues={{ name: "", slug: "", description: "" }}
        showDescription
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  News  " } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "  news  " } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  Latest updates  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));

    expect(onSubmit).toHaveBeenCalledWith({ name: "News", slug: "news", description: "Latest updates" });
  });

  it("blocks submission and shows a validation message when name or slug is empty", () => {
    const onSubmit = vi.fn();
    render(
      <TaxonomyFormModal
        mode="create"
        entityLabel="tag"
        initialValues={{ name: "", slug: "" }}
        showDescription={false}
        isSubmitting={false}
        serverError={null}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/name and slug are required/i);
  });

  it("renders the server error alongside the submit button", () => {
    render(
      <TaxonomyFormModal
        mode="edit"
        entityLabel="tag"
        initialValues={{ name: "News", slug: "news" }}
        showDescription={false}
        isSubmitting={false}
        serverError="A tag with this slug already exists."
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("A tag with this slug already exists.");
  });

  it("disables the form while submitting and shows a busy label", () => {
    render(
      <TaxonomyFormModal
        mode="edit"
        entityLabel="tag"
        initialValues={{ name: "News", slug: "news" }}
        showDescription={false}
        isSubmitting
        serverError={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("calls onCancel from the Cancel button", () => {
    const onCancel = vi.fn();
    render(
      <TaxonomyFormModal
        mode="create"
        entityLabel="tag"
        initialValues={{ name: "", slug: "" }}
        showDescription={false}
        isSubmitting={false}
        serverError={null}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

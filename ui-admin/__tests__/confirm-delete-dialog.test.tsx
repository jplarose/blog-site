import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConfirmDeleteDialog from "@/components/posts/ConfirmDeleteDialog";

describe("ConfirmDeleteDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders as a labeled modal dialog naming the post", () => {
    render(
      <ConfirmDeleteDialog postTitle="My Post" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/delete.*My Post.*\?/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("focuses the Cancel button on open, defaulting away from the destructive action", () => {
    render(
      <ConfirmDeleteDialog postTitle="My Post" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("calls onConfirm when the delete button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog postTitle="My Post" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteDialog postTitle="My Post" isSubmitting={false} serverError={null} onCancel={onCancel} onConfirm={vi.fn()} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalled();
  });

  it("disables both buttons while submitting", () => {
    render(
      <ConfirmDeleteDialog postTitle="My Post" isSubmitting={true} serverError={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });

  it("surfaces a server error message", () => {
    render(
      <ConfirmDeleteDialog
        postTitle="My Post"
        isSubmitting={false}
        serverError="The post could not be deleted."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The post could not be deleted.");
  });
});

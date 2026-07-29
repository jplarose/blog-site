import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PaginationControls from "@/components/posts/PaginationControls";

describe("PaginationControls", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the current page, total pages, and total count", () => {
    render(<PaginationControls page={2} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/45 posts/)).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    render(<PaginationControls page={1} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    render(<PaginationControls page={3} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("calls onPageChange with page + 1 when Next is clicked", () => {
    const onPageChange = vi.fn();
    render(<PaginationControls page={1} pageSize={20} total={45} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("treats zero results as a single empty page", () => {
    render(<PaginationControls page={1} pageSize={20} total={0} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostListFilters from "@/components/posts/PostListFilters";
import type { Category } from "@/lib/api";

const categories: Category[] = [
  { id: 1, name: "News", slug: "news", postCount: 3, createdAt: "", updatedAt: "" },
  { id: 2, name: "Reviews", slug: "reviews", postCount: 1, createdAt: "", updatedAt: "" },
];

describe("PostListFilters", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a tab for every status plus All", () => {
    render(
      <PostListFilters
        status="All"
        categoryId=""
        categories={categories}
        onStatusChange={vi.fn()}
        onCategoryChange={vi.fn()}
      />,
    );

    for (const label of ["All", "Draft", "Scheduled", "Published", "Archived"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the active status tab as selected", () => {
    render(
      <PostListFilters
        status="Published"
        categoryId=""
        categories={categories}
        onStatusChange={vi.fn()}
        onCategoryChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Published" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Draft" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onStatusChange when a tab is clicked", () => {
    const onStatusChange = vi.fn();
    render(
      <PostListFilters
        status="All"
        categoryId=""
        categories={categories}
        onStatusChange={onStatusChange}
        onCategoryChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Archived" }));

    expect(onStatusChange).toHaveBeenCalledWith("Archived");
  });

  it("calls onCategoryChange with the selected category id", () => {
    const onCategoryChange = vi.fn();
    render(
      <PostListFilters
        status="All"
        categoryId=""
        categories={categories}
        onStatusChange={vi.fn()}
        onCategoryChange={onCategoryChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "2" } });

    expect(onCategoryChange).toHaveBeenCalledWith("2");
  });
});

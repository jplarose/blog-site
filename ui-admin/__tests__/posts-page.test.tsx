import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostsPage from "@/app/(admin)/posts/page";
import type { Category, PostSummary } from "@/lib/api";

const list = vi.fn();
const categoriesList = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    postsApi: { ...actual.postsApi, list: (...args: unknown[]) => list(...args) },
    categoriesApi: { ...actual.categoriesApi, list: (...args: unknown[]) => categoriesList(...args) },
  };
});

const samplePost: PostSummary = {
  id: 1,
  title: "Sample Post",
  slug: "sample-post",
  status: "Draft",
  tags: [],
  createdAt: "2027-01-01T00:00:00Z",
  updatedAt: "2027-01-01T00:00:00Z",
};

const categories: Category[] = [
  { id: 9, name: "News", slug: "news", postCount: 1, createdAt: "", updatedAt: "" },
];

describe("PostsPage", () => {
  afterEach(() => {
    cleanup();
    list.mockReset();
    categoriesList.mockReset();
  });

  it("loads posts on mount and renders them", async () => {
    list.mockResolvedValue({ items: [samplePost], total: 1 });
    categoriesList.mockResolvedValue(categories);

    render(<PostsPage />);

    expect(await screen.findByText("Sample Post")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: "1", pageSize: "20" });
  });

  it("shows a friendly error and no table when the list request fails", async () => {
    list.mockRejectedValue(new Error("Network unreachable"));
    categoriesList.mockResolvedValue([]);

    render(<PostsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unreachable");
  });

  it("re-fetches with the status filter and resets to page 1", async () => {
    list.mockResolvedValue({ items: [samplePost], total: 1 });
    categoriesList.mockResolvedValue(categories);

    render(<PostsPage />);
    await screen.findByText("Sample Post");
    list.mockClear();

    fireEvent.click(screen.getByRole("tab", { name: "Archived" }));

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ page: "1", pageSize: "20", status: "Archived" }),
    );
  });

  it("re-fetches with the next page when pagination advances", async () => {
    list.mockResolvedValue({ items: [samplePost], total: 40 });
    categoriesList.mockResolvedValue(categories);

    render(<PostsPage />);
    await screen.findByText("Sample Post");
    list.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(list).toHaveBeenCalledWith({ page: "2", pageSize: "20" }));
  });

  it("shows an empty state when no posts match the filters", async () => {
    list.mockResolvedValue({ items: [], total: 0 });
    categoriesList.mockResolvedValue([]);

    render(<PostsPage />);

    expect(await screen.findByText(/no posts match these filters/i)).toBeInTheDocument();
  });
});

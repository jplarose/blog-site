import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CategoriesManager from "@/components/taxonomy/CategoriesManager";
import { ApiError, type Category } from "@/lib/api";

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    categoriesApi: {
      list: (...args: unknown[]) => list(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  };
});

const news: Category = {
  id: 1,
  name: "News",
  slug: "news",
  description: "Daily updates",
  postCount: 2,
  createdAt: "2027-01-01T00:00:00Z",
  updatedAt: "2027-01-01T00:00:00Z",
};

describe("CategoriesManager", () => {
  afterEach(() => {
    cleanup();
    list.mockReset();
    create.mockReset();
    update.mockReset();
    del.mockReset();
  });

  it("loads categories on mount and renders them", async () => {
    list.mockResolvedValue([news]);
    render(<CategoriesManager />);

    expect(screen.getByText(/loading categories/i)).toBeInTheDocument();
    expect(await screen.findByText("News")).toBeInTheDocument();
  });

  it("shows an alert when the initial load fails", async () => {
    list.mockRejectedValue(new Error("Network unreachable"));
    render(<CategoriesManager />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unreachable");
  });

  it("shows an empty state when there are no categories", async () => {
    list.mockResolvedValue([]);
    render(<CategoriesManager />);

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
  });

  it("creates a category and adds it to the list immutably", async () => {
    list.mockResolvedValue([]);
    const created: Category = { ...news, id: 2, name: "Guides", slug: "guides", postCount: 0 };
    create.mockResolvedValue(created);
    render(<CategoriesManager />);

    await screen.findByText(/no categories yet/i);
    fireEvent.click(screen.getByRole("button", { name: "+ New Category" }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Guides" } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() => expect(screen.getByText("Guides")).toBeInTheDocument());
    expect(create).toHaveBeenCalledWith({ name: "Guides", slug: "guides", description: "" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the duplicate-name 409 message on the create form without closing it", async () => {
    list.mockResolvedValue([news]);
    create.mockRejectedValue(new ApiError(409, "API error 409: A category with this name already exists."));
    render(<CategoriesManager />);

    await screen.findByText("News");
    fireEvent.click(screen.getByRole("button", { name: "+ New Category" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "News" } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("A category with this name already exists."),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the 400 validation message on the create form", async () => {
    list.mockResolvedValue([]);
    create.mockRejectedValue(new ApiError(400, "API error 400: Category slug must contain only lowercase letters, digits, and hyphens."));
    render(<CategoriesManager />);

    await screen.findByText(/no categories yet/i);
    fireEvent.click(screen.getByRole("button", { name: "+ New Category" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "News" } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Category slug must contain only lowercase letters, digits, and hyphens.",
      ),
    );
  });

  it("edits a category and updates the list immutably", async () => {
    list.mockResolvedValue([news]);
    const updated: Category = { ...news, name: "Announcements" };
    update.mockResolvedValue(updated);
    render(<CategoriesManager />);

    await screen.findByText("News");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Announcements" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() => expect(screen.getByText("Announcements")).toBeInTheDocument());
    expect(update).toHaveBeenCalledWith(1, { name: "Announcements", slug: "news", description: "Daily updates" });
  });

  it("deletes an unreferenced category and removes it from the list", async () => {
    list.mockResolvedValue([news]);
    del.mockResolvedValue(undefined);
    render(<CategoriesManager />);

    await screen.findByText("News");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));

    await waitFor(() => expect(screen.queryByText("News")).not.toBeInTheDocument());
    expect(del).toHaveBeenCalledWith(1);
  });

  it("shows a distinct in-use message on 409 referenced-delete and keeps the item in the list", async () => {
    list.mockResolvedValue([news]);
    del.mockRejectedValue(
      new ApiError(409, "API error 409: Category cannot be deleted because it is still referenced by posts."),
    );
    render(<CategoriesManager />);

    await screen.findByText("News");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/in use by 2 posts/i));
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not show default-template copy anywhere on the page", async () => {
    list.mockResolvedValue([news]);
    render(<CategoriesManager />);

    await screen.findByText("News");
    expect(screen.queryByText(/default template/i)).not.toBeInTheDocument();
  });

  it("removes the row and shows a stale-row notice when editing a category that 404s (deleted elsewhere)", async () => {
    list.mockResolvedValue([news]);
    update.mockRejectedValue(new ApiError(404, "API error 404: Category was not found."));
    render(<CategoriesManager />);

    await screen.findByText("News");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() => expect(screen.queryByText("News")).not.toBeInTheDocument());
    expect(screen.getAllByText(/no longer exists/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes the row and shows a stale-row notice when deleting a category that 404s (already gone)", async () => {
    list.mockResolvedValue([news]);
    del.mockRejectedValue(new ApiError(404, "API error 404: Category was not found."));
    render(<CategoriesManager />);

    await screen.findByText("News");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));

    await waitFor(() => expect(screen.queryByText("News")).not.toBeInTheDocument());
    expect(screen.getAllByText(/no longer exists/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

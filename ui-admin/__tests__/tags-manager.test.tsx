import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TagsManager from "@/components/taxonomy/TagsManager";
import { ApiError, type Tag } from "@/lib/api";

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    tagsApi: {
      list: (...args: unknown[]) => list(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  };
});

const featured: Tag = {
  id: 1,
  name: "Featured",
  slug: "featured",
  postCount: 3,
  createdAt: "2027-01-01T00:00:00Z",
};

describe("TagsManager", () => {
  afterEach(() => {
    cleanup();
    list.mockReset();
    create.mockReset();
    update.mockReset();
    del.mockReset();
  });

  it("loads tags on mount and renders them without a description column", async () => {
    list.mockResolvedValue([featured]);
    render(<TagsManager />);

    expect(screen.getByText(/loading tags/i)).toBeInTheDocument();
    expect(await screen.findByText("Featured")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("shows an alert when the initial load fails", async () => {
    list.mockRejectedValue(new Error("Network unreachable"));
    render(<TagsManager />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unreachable");
  });

  it("creates a tag without a description field", async () => {
    list.mockResolvedValue([]);
    const created: Tag = { ...featured, id: 2, name: "Guides", slug: "guides", postCount: 0 };
    create.mockResolvedValue(created);
    render(<TagsManager />);

    await screen.findByText(/no tags yet/i);
    fireEvent.click(screen.getByRole("button", { name: "+ New Tag" }));
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Guides" } });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => expect(screen.getByText("Guides")).toBeInTheDocument());
    expect(create).toHaveBeenCalledWith({ name: "Guides", slug: "guides" });
  });

  it("shows the duplicate-slug 409 message on the create form without closing it", async () => {
    list.mockResolvedValue([featured]);
    create.mockRejectedValue(new ApiError(409, "API error 409: A tag with this slug already exists."));
    render(<TagsManager />);

    await screen.findByText("Featured");
    fireEvent.click(screen.getByRole("button", { name: "+ New Tag" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Other" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "featured" } });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("A tag with this slug already exists."),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("edits a tag and updates the list immutably", async () => {
    list.mockResolvedValue([featured]);
    const updated: Tag = { ...featured, name: "Spotlight" };
    update.mockResolvedValue(updated);
    render(<TagsManager />);

    await screen.findByText("Featured");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Spotlight" } });
    fireEvent.click(screen.getByRole("button", { name: "Save tag" }));

    await waitFor(() => expect(screen.getByText("Spotlight")).toBeInTheDocument());
    expect(update).toHaveBeenCalledWith(1, { name: "Spotlight", slug: "featured" });
  });

  it("deletes an unreferenced tag and removes it from the list", async () => {
    list.mockResolvedValue([featured]);
    del.mockResolvedValue(undefined);
    render(<TagsManager />);

    await screen.findByText("Featured");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));

    await waitFor(() => expect(screen.queryByText("Featured")).not.toBeInTheDocument());
    expect(del).toHaveBeenCalledWith(1);
  });

  it("shows a distinct in-use message on 409 referenced-delete and keeps the item in the list", async () => {
    list.mockResolvedValue([featured]);
    del.mockRejectedValue(
      new ApiError(409, "API error 409: Tag cannot be deleted because it is still referenced by posts."),
    );
    render(<TagsManager />);

    await screen.findByText("Featured");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/in use by 3 posts/i));
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("removes the row and shows a stale-row notice when editing a tag that 404s (deleted elsewhere)", async () => {
    list.mockResolvedValue([featured]);
    update.mockRejectedValue(new ApiError(404, "API error 404: Tag was not found."));
    render(<TagsManager />);

    await screen.findByText("Featured");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save tag" }));

    await waitFor(() => expect(screen.queryByText("Featured")).not.toBeInTheDocument());
    expect(screen.getAllByText(/no longer exists/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes the row and shows a stale-row notice when deleting a tag that 404s (already gone)", async () => {
    list.mockResolvedValue([featured]);
    del.mockRejectedValue(new ApiError(404, "API error 404: Tag was not found."));
    render(<TagsManager />);

    await screen.findByText("Featured");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));

    await waitFor(() => expect(screen.queryByText("Featured")).not.toBeInTheDocument());
    expect(screen.getAllByText(/no longer exists/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

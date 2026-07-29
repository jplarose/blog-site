import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostRowActions from "@/components/posts/PostRowActions";
import { ApiError } from "@/lib/api";
import type { Post, PostSummary } from "@/lib/api";

const publish = vi.fn();
const archive = vi.fn();
const schedule = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    postsApi: {
      publish: (...args: unknown[]) => publish(...args),
      archive: (...args: unknown[]) => archive(...args),
      schedule: (...args: unknown[]) => schedule(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  };
});

const draftPost: PostSummary = {
  id: 1,
  title: "Draft Post",
  slug: "draft-post",
  status: "Draft",
  tags: [],
  createdAt: "2027-01-01T00:00:00Z",
  updatedAt: "2027-01-01T00:00:00Z",
};

function renderActions(post: PostSummary = draftPost) {
  const onChanged = vi.fn();
  const onDeleted = vi.fn();
  const onError = vi.fn();
  render(<PostRowActions post={post} onChanged={onChanged} onDeleted={onDeleted} onError={onError} />);
  return { onChanged, onDeleted, onError };
}

describe("PostRowActions", () => {
  afterEach(() => {
    cleanup();
    publish.mockReset();
    archive.mockReset();
    schedule.mockReset();
    del.mockReset();
  });

  it("shows Publish, Schedule, and Archive for a Draft post but not for Published", () => {
    renderActions(draftPost);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();

    cleanup();
    renderActions({ ...draftPost, status: "Published" });
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("calls postsApi.publish and reports the updated post", async () => {
    const updated: Post = { ...draftPost, status: "Published", content: "", categoryName: undefined } as Post;
    publish.mockResolvedValue(updated);
    const { onChanged } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
    expect(publish).toHaveBeenCalledWith(1);
  });

  it("reports a friendly error when publish fails", async () => {
    publish.mockRejectedValue(new ApiError(500, "API error 500: boom"));
    const { onError } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Failed to publish the post."));
  });

  it("calls postsApi.archive and reports the updated post", async () => {
    const updated: Post = { ...draftPost, status: "Archived" } as Post;
    archive.mockResolvedValue(updated);
    const { onChanged } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
    expect(archive).toHaveBeenCalledWith(1);
  });

  it("opens the schedule dialog, calls postsApi.schedule, and closes on success", async () => {
    const updated: Post = { ...draftPost, status: "Scheduled" } as Post;
    schedule.mockResolvedValue(updated);
    const { onChanged } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText(/publish date/i), { target: { value: future } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
    expect(schedule).toHaveBeenCalledWith(1, expect.any(String));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the schedule dialog open and shows the server's 409 message on conflict", async () => {
    schedule.mockRejectedValue(new ApiError(409, "API error 409: Only Draft or Scheduled posts can be scheduled"));
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    const dialog = screen.getByRole("dialog");
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText(/publish date/i), { target: { value: future } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Only Draft or Scheduled posts can be scheduled"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the delete dialog, calls postsApi.delete, and reports the deletion", async () => {
    del.mockResolvedValue(undefined);
    const { onDeleted } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1));
    expect(del).toHaveBeenCalledWith(1);
  });
});

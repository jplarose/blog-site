import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostListTable from "@/components/posts/PostListTable";
import type { PostSummary } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    postsApi: { publish: vi.fn(), archive: vi.fn(), schedule: vi.fn(), delete: vi.fn() },
  };
});

const posts: PostSummary[] = [
  {
    id: 1,
    title: "First Post",
    slug: "first-post",
    status: "Published",
    categoryName: "News",
    publishedAt: "2027-02-01T00:00:00Z",
    tags: [],
    createdAt: "2027-01-01T00:00:00Z",
    updatedAt: "2027-01-01T00:00:00Z",
  },
  {
    id: 2,
    title: "Second Post",
    slug: "second-post",
    status: "Draft",
    tags: [],
    createdAt: "2027-01-05T00:00:00Z",
    updatedAt: "2027-01-05T00:00:00Z",
  },
];

describe("PostListTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a loading state", () => {
    render(<PostListTable posts={[]} isLoading onChanged={vi.fn()} onDeleted={vi.fn()} onRowError={vi.fn()} />);
    expect(screen.getByText(/loading posts/i)).toBeInTheDocument();
  });

  it("shows an empty state with a create-post link when there are no posts", () => {
    render(<PostListTable posts={[]} isLoading={false} onChanged={vi.fn()} onDeleted={vi.fn()} onRowError={vi.fn()} />);
    expect(screen.getByText(/no posts match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a post" })).toHaveAttribute("href", "/posts/new");
  });

  it("renders a row per post with title, category, and status", () => {
    render(<PostListTable posts={posts} isLoading={false} onChanged={vi.fn()} onDeleted={vi.fn()} onRowError={vi.fn()} />);

    expect(screen.getByRole("link", { name: "First Post" })).toHaveAttribute("href", "/posts/1");
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Second Post" })).toHaveAttribute("href", "/posts/2");
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders a category placeholder when the post has none", () => {
    render(<PostListTable posts={[posts[1]]} isLoading={false} onChanged={vi.fn()} onDeleted={vi.fn()} onRowError={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

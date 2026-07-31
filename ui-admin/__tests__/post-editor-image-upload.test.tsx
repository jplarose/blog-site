import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PostEditorForm from "@/components/post-editor/PostEditorForm";
import { mediaApi } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    categoriesApi: { list: vi.fn().mockResolvedValue([]) },
    templatesApi: { list: vi.fn().mockResolvedValue([]), get: vi.fn() },
    tagsApi: { list: vi.fn().mockResolvedValue([]) },
    mediaApi: { uploadImage: vi.fn() },
  };
});

describe("PostEditorForm featured image uploads", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(mediaApi.uploadImage).mockReset();
  });

  it("stores a successful featured-image upload", async () => {
    vi.mocked(mediaApi.uploadImage).mockResolvedValue({
      url: "https://media.example/featured.png",
    });
    render(<PostEditorForm mode="create" />);

    fireEvent.change(await screen.findByLabelText("Featured image"), {
      target: {
        files: [new File(["image"], "featured.png", { type: "image/png" })],
      },
    });

    expect(
      await screen.findByAltText("Featured image preview"),
    ).toHaveAttribute("src", "https://media.example/featured.png");
  });

  it("preserves the featured image when replacement fails", async () => {
    vi.mocked(mediaApi.uploadImage).mockRejectedValue(
      new Error("Storage unavailable"),
    );
    render(
      <PostEditorForm
        mode="edit"
        postId={1}
        initialPost={{
          id: 1,
          title: "Post",
          slug: "post",
          content: "",
          featuredImageUrl: "https://media.example/existing.png",
          status: "Draft",
          tags: [],
          createdAt: "2026-06-21T00:00:00Z",
          updatedAt: "2026-06-21T00:00:00Z",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Replace Featured image"), {
      target: {
        files: [new File(["image"], "new.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
    expect(screen.getByAltText("Featured image preview")).toHaveAttribute(
      "src",
      "https://media.example/existing.png",
    );
  });
});

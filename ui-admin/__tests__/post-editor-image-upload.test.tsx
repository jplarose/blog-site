import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PostEditorForm from "@/components/post-editor/PostEditorForm";
import { mediaApi, templatesApi } from "@/lib/api";
import type { LayoutTemplate } from "@/lib/template-schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    categoriesApi: { list: vi.fn().mockResolvedValue([]) },
    templatesApi: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
    },
    mediaApi: { uploadImage: vi.fn() },
  };
});

const imageTemplate: LayoutTemplate = {
  id: 7,
  name: "Image template",
  description: "",
  isDefault: false,
  createdAt: "2026-06-21T00:00:00Z",
  updatedAt: "2026-06-21T00:00:00Z",
  layout: {
    version: 1,
    canvas: { width: 960, minRowHeight: 160, backgroundColor: "#ffffff" },
    rootBlockIds: ["image-1", "gallery-1"],
    blocks: {
      "image-1": {
        id: "image-1",
        kind: "image",
        label: "Hero art",
        parentId: null,
        content: {
          key: "hero_art",
          kind: "image",
          label: "Hero art",
        },
      },
      "gallery-1": {
        id: "gallery-1",
        kind: "gallery",
        label: "Gallery",
        parentId: null,
        content: {
          key: "gallery",
          kind: "gallery",
          label: "Gallery",
        },
      },
    },
  },
};

describe("PostEditorForm image uploads", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(mediaApi.uploadImage).mockReset();
    vi.mocked(templatesApi.list).mockReset();
    vi.mocked(templatesApi.list).mockResolvedValue([]);
    vi.mocked(templatesApi.get).mockReset();
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

  it("stores a successful template-image upload", async () => {
    vi.mocked(templatesApi.list).mockResolvedValue([imageTemplate]);
    vi.mocked(templatesApi.get).mockResolvedValue(imageTemplate);
    vi.mocked(mediaApi.uploadImage).mockResolvedValue({
      url: "https://media.example/hero.png",
    });
    render(<PostEditorForm mode="create" />);

    fireEvent.change(await screen.findByLabelText("Layout Template"), {
      target: { value: "7" },
    });
    fireEvent.change(await screen.findByLabelText("Hero art"), {
      target: {
        files: [new File(["image"], "hero.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByAltText("Hero art preview")).toHaveAttribute(
      "src",
      "https://media.example/hero.png",
    );
  });

  it("adds a gallery item only after upload succeeds", async () => {
    let finishUpload:
      | ((value: { url: string }) => void)
      | undefined;
    vi.mocked(templatesApi.list).mockResolvedValue([imageTemplate]);
    vi.mocked(templatesApi.get).mockResolvedValue(imageTemplate);
    vi.mocked(mediaApi.uploadImage).mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    render(<PostEditorForm mode="create" />);

    fireEvent.change(await screen.findByLabelText("Layout Template"), {
      target: { value: "7" },
    });
    fireEvent.change(await screen.findByLabelText("Add Gallery image"), {
      target: {
        files: [new File(["image"], "gallery.png", { type: "image/png" })],
      },
    });

    expect(screen.queryByAltText("Gallery image preview")).not.toBeInTheDocument();
    finishUpload?.({ url: "https://media.example/gallery.png" });

    expect(await screen.findByAltText("Gallery image preview")).toHaveAttribute(
      "src",
      "https://media.example/gallery.png",
    );
  });

  it("does not add a gallery item when upload fails", async () => {
    vi.mocked(templatesApi.list).mockResolvedValue([imageTemplate]);
    vi.mocked(templatesApi.get).mockResolvedValue(imageTemplate);
    vi.mocked(mediaApi.uploadImage).mockRejectedValue(
      new Error("Storage unavailable"),
    );
    render(<PostEditorForm mode="create" />);

    fireEvent.change(await screen.findByLabelText("Layout Template"), {
      target: { value: "7" },
    });
    fireEvent.change(await screen.findByLabelText("Add Gallery image"), {
      target: {
        files: [new File(["image"], "gallery.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
    expect(screen.queryByAltText("Gallery image preview")).not.toBeInTheDocument();
    expect(screen.getByText("No gallery images added yet.")).toBeInTheDocument();
  });
});

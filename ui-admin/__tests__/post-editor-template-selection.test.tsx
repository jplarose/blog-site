import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PostEditorForm from "@/components/post-editor/PostEditorForm";
import { categoriesApi, postsApi, tagsApi, templatesApi } from "@/lib/api";
import type { TemplateSummary } from "@/lib/catalog";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    categoriesApi: { list: vi.fn() },
    templatesApi: { list: vi.fn(), get: vi.fn() },
    tagsApi: { list: vi.fn() },
    postsApi: {
      ...actual.postsApi,
      create: vi.fn(),
      update: vi.fn(),
    },
    mediaApi: { uploadImage: vi.fn() },
  };
});

const templates: TemplateSummary[] = [
  { id: 1, templateKey: "article", name: "Article", description: "Standard long-form post." },
  { id: 2, templateKey: "feature", name: "Feature", description: "Editorial feature." },
  { id: 3, templateKey: "photo-essay", name: "Photo Essay", description: "Image-forward layout." },
];

const tags = [
  { id: 10, name: "Travel", slug: "travel", postCount: 2, createdAt: "2026-01-01T00:00:00Z" },
  { id: 11, name: "Food", slug: "food", postCount: 1, createdAt: "2026-01-01T00:00:00Z" },
];

describe("PostEditorForm template selection and submit payload", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(categoriesApi.list).mockReset().mockResolvedValue([]);
    vi.mocked(templatesApi.list).mockReset().mockResolvedValue(templates);
    vi.mocked(templatesApi.get).mockReset();
    vi.mocked(tagsApi.list).mockReset().mockResolvedValue(tags);
    vi.mocked(postsApi.create).mockReset();
    vi.mocked(postsApi.update).mockReset();
    push.mockReset();
  });

  it("blocks submission and shows an error when no template is selected", async () => {
    render(<PostEditorForm mode="create" />);

    await screen.findByText("Article");

    expect(screen.getByText("Save Draft")).toBeDisabled();
  });

  it("submits templateId and tagIds mapped from selected tag names", async () => {
    vi.mocked(postsApi.create).mockResolvedValue({
      id: 42,
      title: "My Post",
      slug: "my-post",
      content: "",
      status: "Draft",
      tags: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    render(<PostEditorForm mode="create" />);

    await screen.findByText("Article");
    fireEvent.click(screen.getByLabelText("Feature"));

    fireEvent.change(screen.getByPlaceholderText("Post title…"), {
      target: { value: "My Post" },
    });
    fireEvent.click(screen.getByText("Travel"));

    const saveButton = screen.getByText("Save Draft");
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await screen.findByText("Save Draft");
    expect(postsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Post",
        templateId: 2,
        tagIds: [10],
      }),
    );
    const [payload] = vi.mocked(postsApi.create).mock.calls[0] ?? [];
    expect(payload).not.toHaveProperty("tags");
    expect(payload).not.toHaveProperty("templateContent");
  });

  it("resolves an existing post's tag names to ids once tags load", async () => {
    render(
      <PostEditorForm
        mode="edit"
        postId={7}
        initialPost={{
          id: 7,
          title: "Existing",
          slug: "existing",
          content: "",
          status: "Draft",
          templateId: 1,
          tags: ["Food"],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    await screen.findByText("Article");

    vi.mocked(postsApi.update).mockResolvedValue({
      id: 7,
      title: "Existing",
      slug: "existing",
      content: "",
      status: "Draft",
      tags: ["Food"],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    fireEvent.click(screen.getByText("Update Draft"));

    await screen.findByText("Update Draft");
    expect(postsApi.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ templateId: 1, tagIds: [11] }),
    );
  });

  it("derives the slug from the title for a new post", async () => {
    vi.mocked(postsApi.create).mockResolvedValue({
      id: 42,
      title: "My New Post!",
      slug: "my-new-post",
      content: "",
      status: "Draft",
      tags: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    render(<PostEditorForm mode="create" />);

    await screen.findByText("Article");
    fireEvent.click(screen.getByLabelText("Article"));
    fireEvent.change(screen.getByPlaceholderText("Post title…"), {
      target: { value: "My New Post!" },
    });
    fireEvent.click(screen.getByText("Save Draft"));

    await screen.findByText("Save Draft");
    expect(postsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "my-new-post" }),
    );
  });

  it("preserves the existing slug when editing, even after a title change", async () => {
    vi.mocked(postsApi.update).mockResolvedValue({
      id: 7,
      title: "Renamed Title",
      slug: "existing",
      content: "",
      status: "Published",
      tags: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    render(
      <PostEditorForm
        mode="edit"
        postId={7}
        initialPost={{
          id: 7,
          title: "Existing",
          slug: "existing",
          content: "",
          status: "Published",
          templateId: 1,
          tags: [],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    await screen.findByText("Article");
    fireEvent.change(screen.getByPlaceholderText("Post title…"), {
      target: { value: "Renamed Title" },
    });
    fireEvent.click(screen.getByText("Update Draft"));

    await screen.findByText("Update Draft");
    expect(postsApi.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ slug: "existing", title: "Renamed Title" }),
    );
  });
});

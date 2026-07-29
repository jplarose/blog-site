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
];

const savedPost = {
  id: 7,
  title: "Existing",
  slug: "existing",
  content: "<p>Hello</p>",
  status: "Draft" as const,
  tags: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

/**
 * Regression tests for the post `content` wire contract (final branch
 * review, finding 1): the admin must submit sanitized rich HTML — never a
 * serialized Tiptap JSON document — because the API sanitizer and the
 * public-site template renderer both treat `content` as rich HTML.
 */
describe("PostEditorForm content wire contract", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(categoriesApi.list).mockReset().mockResolvedValue([]);
    vi.mocked(templatesApi.list).mockReset().mockResolvedValue(templates);
    vi.mocked(templatesApi.get).mockReset();
    vi.mocked(tagsApi.list).mockReset().mockResolvedValue([]);
    vi.mocked(postsApi.create).mockReset();
    vi.mocked(postsApi.update).mockReset().mockResolvedValue(savedPost);
    push.mockReset();
  });

  function expectHtmlContent(content: unknown): void {
    expect(typeof content).toBe("string");
    const value = content as string;
    expect(value.startsWith("<")).toBe(true);
    expect(value).not.toContain('{"type":"doc"');
    const doc = new DOMParser().parseFromString(value, "text/html");
    expect(doc.body.childElementCount).toBeGreaterThan(0);
  }

  it("submits legacy Tiptap-JSON content converted to rich HTML", async () => {
    const legacyJsonContent = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world", marks: [{ type: "bold" }] },
          ],
        },
      ],
    });

    render(
      <PostEditorForm
        mode="edit"
        postId={7}
        initialPost={{ ...savedPost, content: legacyJsonContent, templateId: 1 }}
      />,
    );

    await screen.findByText("Article");
    fireEvent.click(screen.getByText("Update Draft"));
    await screen.findByText("Update Draft");

    expect(postsApi.update).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(postsApi.update).mock.calls[0]![1] as { content: string };
    expectHtmlContent(payload.content);
    expect(payload.content).toContain("<strong>world</strong>");
  });

  it("submits stored rich HTML content unchanged (not escaped, not JSON)", async () => {
    render(
      <PostEditorForm
        mode="edit"
        postId={7}
        initialPost={{ ...savedPost, content: "<p>Hello <em>there</em></p>", templateId: 1 }}
      />,
    );

    await screen.findByText("Article");
    fireEvent.click(screen.getByText("Update Draft"));
    await screen.findByText("Update Draft");

    expect(postsApi.update).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(postsApi.update).mock.calls[0]![1] as { content: string };
    expectHtmlContent(payload.content);
    expect(payload.content).toBe("<p>Hello <em>there</em></p>");
  });
});

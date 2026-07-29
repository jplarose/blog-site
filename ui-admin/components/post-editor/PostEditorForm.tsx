"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ImageUploadControl from "@/components/media/ImageUploadControl";
import RichTextEditor from "@/components/rte/RichTextEditor";
import { richTextJsonToHtml, richTextToHtml } from "@/components/rte/toHtml";
import TagSelector from "@/components/post-editor/TagSelector";
import TemplateCards from "@/components/post-editor/TemplateCards";
import TemplatePreview from "@/components/post-editor/TemplatePreview";
import {
  categoriesApi,
  postsApi,
  tagsApi,
  templatesApi,
  type Category,
  type Post,
  type PostStatus,
  type Tag,
} from "@/lib/api";
import type { CatalogTemplate, TemplateSummary } from "@/lib/catalog";

type TabType = "write" | "preview";

interface PostEditorFormProps {
  mode: "create" | "edit";
  postId?: number;
  initialPost?: Post | null;
}

export default function PostEditorForm({
  mode,
  postId,
  initialPost = null,
}: PostEditorFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("write");
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [status, setStatus] = useState<PostStatus>(initialPost?.status ?? "Draft");
  const [scheduledAt, setScheduledAt] = useState(
    initialPost?.scheduledAt ? toDatetimeLocalValue(initialPost.scheduledAt) : "",
  );
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialPost?.featuredImageUrl ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialPost?.categoryId ? String(initialPost.categoryId) : "",
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialPost?.templateId ? String(initialPost.templateId) : "",
  );
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<CatalogTemplate | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(true);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadOrganizationData() {
      try {
        const [nextCategories, nextTemplates, nextTags] = await Promise.all([
          categoriesApi.list(),
          templatesApi.list(),
          tagsApi.list(),
        ]);

        if (!isActive) return;

        setCategories(nextCategories);
        setTemplates(nextTemplates);
        setTags(nextTags);
        setOrganizationError(null);
      } catch (error) {
        if (!isActive) return;

        setOrganizationError(
          error instanceof Error ? error.message : "Failed to load categories, templates, and tags.",
        );
      } finally {
        if (isActive) setIsOrganizationLoading(false);
      }
    }

    void loadOrganizationData();

    return () => {
      isActive = false;
    };
  }, []);

  // Resolve the existing post's tag names to ids once the managed tag list loads.
  useEffect(() => {
    if (!initialPost || tags.length === 0) return;

    const resolvedIds = tags
      .filter((tag) => initialPost.tags.includes(tag.name))
      .map((tag) => tag.id);

    setSelectedTagIds(resolvedIds);
    // Only needs to run once per loaded tag list; initialPost is stable per editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  useEffect(() => {
    let isActive = true;

    async function loadTemplate() {
      if (!selectedTemplateId) {
        setActiveTemplate(null);
        setTemplateError(null);
        return;
      }

      setIsTemplateLoading(true);

      try {
        const nextTemplate = await templatesApi.get(Number(selectedTemplateId));
        if (!isActive) return;

        setActiveTemplate(nextTemplate);
        setTemplateError(null);
      } catch (error) {
        if (!isActive) return;

        setActiveTemplate(null);
        setTemplateError(error instanceof Error ? error.message : "Failed to load template.");
      } finally {
        if (isActive) setIsTemplateLoading(false);
      }
    }

    void loadTemplate();

    return () => {
      isActive = false;
    };
  }, [selectedTemplateId]);

  function toggleTag(tagId: number) {
    setSelectedTagIds((currentIds) =>
      currentIds.includes(tagId)
        ? currentIds.filter((id) => id !== tagId)
        : [...currentIds, tagId],
    );
  }

  async function submitPost(nextStatus: PostStatus) {
    if (!selectedTemplateId) {
      setSubmitError("Choose a template before saving.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      title: title.trim(),
      slug: slugify(title),
      // The wire contract for `content` is sanitized rich HTML (the API
      // sanitizes HTML, the public site renders HTML). `content` state is
      // already HTML after any edit; this also normalizes untouched legacy
      // values (Tiptap JSON / plain text) loaded from older rows.
      content: richTextToHtml(content),
      excerpt: excerpt.trim() || undefined,
      status: nextStatus,
      categoryId: selectedCategoryId ? Number(selectedCategoryId) : undefined,
      templateId: Number(selectedTemplateId),
      tagIds: selectedTagIds,
      featuredImageUrl: featuredImageUrl.trim() || undefined,
      scheduledAt:
        nextStatus === "Scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    };

    try {
      const savedPost =
        mode === "edit" && postId
          ? await postsApi.update(postId, payload)
          : await postsApi.create(payload);

      router.push(`/posts/${savedPost.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save post.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pageTitle = mode === "edit" ? "Edit Post" : "New Post";
  const primaryActionLabel =
    status === "Scheduled"
      ? mode === "edit"
        ? "Update Schedule"
        : "Schedule"
      : status === "Published"
        ? mode === "edit"
          ? "Update & Publish"
          : "Publish"
        : mode === "edit"
          ? "Update Post"
          : "Publish";
  const selectedTagNames = tags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.name);
  const selectedCategoryName = categories.find(
    (category) => String(category.id) === selectedCategoryId,
  )?.name;
  const canSubmit = !isSubmitting && Boolean(selectedTemplateId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/posts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Posts
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">
          Template <span className="text-rose-600">*</span>
        </h2>
        <p className="text-sm text-gray-500">
          Choose the layout your post will render with. This is required and has no editable
          layout controls — only the fields below feed into it.
        </p>
        {organizationError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {organizationError}
          </div>
        ) : null}
        <TemplateCards
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          disabled={isOrganizationLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <input
            type="text"
            placeholder="Post title…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-xl font-semibold placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("write")}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === "write"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Write
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === "preview"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Preview
              </button>
            </div>

            {activeTab === "write" ? (
              <div className="p-4">
                <RichTextEditor
                  initialContent={content}
                  placeholder="Write your post content here… Markdown links and spoiler syntax are supported."
                  ariaLabel="Post content"
                  onChange={(json) => setContent(richTextJsonToHtml(json))}
                  className="min-h-[480px]"
                />
              </div>
            ) : (
              <TemplatePreview
                template={activeTemplate}
                isLoading={isTemplateLoading}
                error={templateError}
                fields={{
                  title,
                  content,
                  excerpt,
                  featuredImageUrl,
                  category: selectedCategoryName ?? "",
                  tags: selectedTagNames,
                }}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Excerpt</label>
            <textarea
              placeholder="Short description shown in post listings…"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Publish</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as PostStatus)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Scheduled">Scheduled</option>
              </select>
            </div>

            {status === "Scheduled" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Publish Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => void submitPost("Draft")}
                disabled={!canSubmit}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {mode === "edit" ? "Update Draft" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => void submitPost(status)}
                disabled={!canSubmit}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : primaryActionLabel}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Organization</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                disabled={isOrganizationLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select a category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tags</label>
              <TagSelector
                tags={tags}
                selectedTagIds={selectedTagIds}
                onToggle={toggleTag}
                disabled={isOrganizationLoading}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Featured Image</h2>
            <ImageUploadControl
              label="Featured image"
              value={featuredImageUrl}
              onUploaded={setFeaturedImageUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDatetimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

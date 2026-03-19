"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import RichTextContent from "@/components/rte/RichTextContent";
import RichTextEditor from "@/components/rte/RichTextEditor";
import TemplateCanvasPreview from "@/components/template-editor/TemplateCanvasPreview";
import { categoriesApi, templatesApi, type Category } from "@/lib/api";
import { getContentBlocksInOrder, type TemplateContentBlock } from "@/lib/template-layout";
import type {
  LayoutTemplate,
  TemplateContentValue,
  TemplateGalleryItemValue,
  TemplateImageValue,
  TemplateSummary,
} from "@/lib/template-schema";

type TabType = "write" | "preview";

export default function NewPostPage() {
  const [activeTab, setActiveTab] = useState<TabType>("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState("Draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<LayoutTemplate | null>(null);
  const [templateContentValues, setTemplateContentValues] = useState<
    Record<string, TemplateContentValue>
  >({});
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(true);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadOrganizationData() {
      try {
        const [nextCategories, nextTemplates] = await Promise.all([
          categoriesApi.list(),
          templatesApi.list(),
        ]);

        if (!isActive) {
          return;
        }

        setCategories(nextCategories);
        setTemplates(nextTemplates);
        setOrganizationError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setOrganizationError(
          error instanceof Error ? error.message : "Failed to load categories and templates.",
        );
      } finally {
        if (isActive) {
          setIsOrganizationLoading(false);
        }
      }
    }

    void loadOrganizationData();

    return () => {
      isActive = false;
    };
  }, []);

  const selectedCategory = categories.find(
    (category) => String(category.id) === selectedCategoryId,
  );
  const categoryDefaultTemplateName = selectedCategory?.defaultTemplateName;
  const effectiveTemplateId =
    selectedTemplateId || (selectedCategory?.defaultTemplateId ? String(selectedCategory.defaultTemplateId) : "");

  useEffect(() => {
    let isActive = true;

    async function loadTemplate() {
      if (!effectiveTemplateId) {
        setActiveTemplate(null);
        setTemplateError(null);
        return;
      }

      setIsTemplateLoading(true);

      try {
        const nextTemplate = await templatesApi.get(Number(effectiveTemplateId));
        if (!isActive) {
          return;
        }

        setActiveTemplate(nextTemplate);
        setTemplateContentValues((currentValues) => {
          const nextValues = { ...currentValues };
          for (const block of getContentBlocksInOrder(nextTemplate.layout)) {
            if (nextValues[block.content.key] === undefined) {
              nextValues[block.content.key] = getDefaultContentValue(block);
            }
          }
          return nextValues;
        });
        setTemplateError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setActiveTemplate(null);
        setTemplateError(error instanceof Error ? error.message : "Failed to load template.");
      } finally {
        if (isActive) {
          setIsTemplateLoading(false);
        }
      }
    }

    void loadTemplate();

    return () => {
      isActive = false;
    };
  }, [effectiveTemplateId]);

  const templateContentBlocks = activeTemplate
    ? getContentBlocksInOrder(activeTemplate.layout)
    : [];

  function updateTemplateStringValue(bindingKey: string, value: string) {
    setTemplateContentValues((currentValues) => ({
      ...currentValues,
      [bindingKey]: value,
    }));
  }

  function updateTemplateImageValue(
    bindingKey: string,
    updater: (currentValue: TemplateImageValue) => TemplateImageValue,
  ) {
    setTemplateContentValues((currentValues) => ({
      ...currentValues,
      [bindingKey]: updater(asImageValue(currentValues[bindingKey])),
    }));
  }

  function updateTemplateGalleryItem(
    bindingKey: string,
    itemId: string,
    updater: (currentItem: TemplateGalleryItemValue) => TemplateGalleryItemValue,
  ) {
    setTemplateContentValues((currentValues) => {
      const currentGallery = asGalleryValue(currentValues[bindingKey]);
      return {
        ...currentValues,
        [bindingKey]: currentGallery.map((item) =>
          item.id === itemId ? updater(item) : item,
        ),
      };
    });
  }

  function addTemplateGalleryItem(bindingKey: string) {
    setTemplateContentValues((currentValues) => ({
      ...currentValues,
      [bindingKey]: [
        ...asGalleryValue(currentValues[bindingKey]),
        { id: crypto.randomUUID(), url: "", alt: "", caption: "" },
      ],
    }));
  }

  function removeTemplateGalleryItem(bindingKey: string, itemId: string) {
    setTemplateContentValues((currentValues) => ({
      ...currentValues,
      [bindingKey]: asGalleryValue(currentValues[bindingKey]).filter((item) => item.id !== itemId),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/posts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Posts
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Post</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <input
            type="text"
            placeholder="Post title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-xl font-semibold placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Write / Preview tabs */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
              activeTemplate ? (
                <div className="space-y-4 p-4">
                  {isTemplateLoading ? (
                    <p className="text-sm text-gray-500">Loading template fields…</p>
                  ) : null}

                  {templateError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {templateError}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                    Editing with template: <strong>{activeTemplate.name}</strong>
                  </div>

                  {templateContentBlocks.map((block) => (
                    <TemplateContentField
                      key={block.id}
                      block={block}
                      postTitle={title}
                      value={templateContentValues[block.content.key]}
                      onStringChange={updateTemplateStringValue}
                      onImageChange={updateTemplateImageValue}
                      onGalleryItemChange={updateTemplateGalleryItem}
                      onGalleryItemAdd={addTemplateGalleryItem}
                      onGalleryItemRemove={removeTemplateGalleryItem}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <RichTextEditor
                    initialContent={content}
                    placeholder="Write your post content here… Markdown links and spoiler syntax are supported."
                    ariaLabel="Post content"
                    onChange={(json) => setContent(JSON.stringify(json))}
                    className="min-h-[480px]"
                  />
                </div>
              )
            ) : (
              <div className="px-6 py-4 prose max-w-none min-h-[480px]">
                {activeTemplate ? (
                  <TemplateCanvasPreview
                    layout={activeTemplate.layout}
                    contentValues={templateContentValues}
                    postTitle={title}
                  />
                ) : content ? (
                  <div>
                    {title && <h1>{title}</h1>}
                    <RichTextContent content={content} className="text-gray-700" />
                  </div>
                ) : (
                  <p className="text-gray-400 italic">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
            <textarea
              placeholder="Short description shown in post listings…"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish panel */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Publish</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Scheduled">Scheduled</option>
              </select>
            </div>

            {status === "Scheduled" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Publish Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Save Draft
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                {status === "Scheduled" ? "Schedule" : "Publish"}
              </button>
            </div>
          </div>

          {/* Category & Template */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Organization</h2>

            {organizationError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {organizationError}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
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
              {selectedCategory?.defaultTemplateName ? (
                <p className="mt-2 text-xs text-gray-500">
                  Category default template: {selectedCategory.defaultTemplateName}
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                placeholder="Add tags…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Layout Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={isOrganizationLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {categoryDefaultTemplateName
                    ? `Use category default (${categoryDefaultTemplateName})`
                    : "Use category default…"}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.isDefault ? " (global default)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Choosing a template now swaps the post editor to that template’s required fields.
              </p>
            </div>
          </div>

          {/* Featured Image */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Featured Image</h2>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface TemplateContentFieldProps {
  block: TemplateContentBlock;
  postTitle: string;
  value: TemplateContentValue | undefined;
  onStringChange: (bindingKey: string, value: string) => void;
  onImageChange: (
    bindingKey: string,
    updater: (currentValue: TemplateImageValue) => TemplateImageValue,
  ) => void;
  onGalleryItemChange: (
    bindingKey: string,
    itemId: string,
    updater: (currentItem: TemplateGalleryItemValue) => TemplateGalleryItemValue,
  ) => void;
  onGalleryItemAdd: (bindingKey: string) => void;
  onGalleryItemRemove: (bindingKey: string, itemId: string) => void;
}

function TemplateContentField({
  block,
  postTitle,
  value,
  onStringChange,
  onImageChange,
  onGalleryItemChange,
  onGalleryItemAdd,
  onGalleryItemRemove,
}: TemplateContentFieldProps) {
  if (block.kind === "title") {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{block.label}</p>
        <p className="mt-1 text-sm text-gray-600">
          This block uses the main post title field. Current value: {postTitle || "Untitled post"}
        </p>
      </div>
    );
  }

  if (block.kind === "richText") {
    return (
      <div className="space-y-2 rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-900">{block.label}</label>
        <RichTextEditor
          initialContent={typeof value === "string" ? value : ""}
          placeholder={block.content.placeholder || `Enter ${block.label.toLowerCase()}…`}
          ariaLabel={block.label}
          onChange={(json) => onStringChange(block.content.key, JSON.stringify(json))}
        />
      </div>
    );
  }

  if (block.kind === "image") {
    const imageValue = asImageValue(value);

    return (
      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-900">{block.label}</label>
        <input
          type="url"
          value={imageValue.url}
          onChange={(event) =>
            onImageChange(block.content.key, (currentValue) => ({
              ...currentValue,
              url: event.target.value,
            }))
          }
          placeholder="https://example.com/image.jpg"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={imageValue.alt ?? ""}
          onChange={(event) =>
            onImageChange(block.content.key, (currentValue) => ({
              ...currentValue,
              alt: event.target.value,
            }))
          }
          placeholder="Alt text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={imageValue.caption ?? ""}
          onChange={(event) =>
            onImageChange(block.content.key, (currentValue) => ({
              ...currentValue,
              caption: event.target.value,
            }))
          }
          placeholder="Caption"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    );
  }

  const galleryItems = asGalleryValue(value);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-900">{block.label}</label>
        <button
          type="button"
          onClick={() => onGalleryItemAdd(block.content.key)}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
        >
          Add Image
        </button>
      </div>

      {galleryItems.length > 0 ? (
        galleryItems.map((item) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <input
              type="url"
              value={item.url}
              onChange={(event) =>
                onGalleryItemChange(block.content.key, item.id, (currentItem) => ({
                  ...currentItem,
                  url: event.target.value,
                }))
              }
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={item.alt ?? ""}
              onChange={(event) =>
                onGalleryItemChange(block.content.key, item.id, (currentItem) => ({
                  ...currentItem,
                  alt: event.target.value,
                }))
              }
              placeholder="Alt text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={item.caption ?? ""}
              onChange={(event) =>
                onGalleryItemChange(block.content.key, item.id, (currentItem) => ({
                  ...currentItem,
                  caption: event.target.value,
                }))
              }
              placeholder="Caption"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => onGalleryItemRemove(block.content.key, item.id)}
              className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600"
            >
              Remove
            </button>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500">No gallery images added yet.</p>
      )}
    </div>
  );
}

function getDefaultContentValue(block: TemplateContentBlock): TemplateContentValue {
  switch (block.kind) {
    case "title":
    case "richText":
      return "";
    case "image":
      return { url: "", alt: "", caption: "" };
    case "gallery":
      return [];
  }
}

function asImageValue(value: TemplateContentValue | undefined): TemplateImageValue {
  if (!value || typeof value === "string" || Array.isArray(value)) {
    return { url: "", alt: "", caption: "" };
  }

  return value;
}

function asGalleryValue(value: TemplateContentValue | undefined): TemplateGalleryItemValue[] {
  return Array.isArray(value) ? value : [];
}

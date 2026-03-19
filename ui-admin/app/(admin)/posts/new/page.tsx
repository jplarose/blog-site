"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import RichTextContent from "@/components/rte/RichTextContent";
import RichTextEditor from "@/components/rte/RichTextEditor";
import { categoriesApi, templatesApi, type Category } from "@/lib/api";
import type { TemplateSummary } from "@/lib/template-schema";

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
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(true);

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
              <div className="p-4">
                <RichTextEditor
                  initialContent={content}
                  placeholder="Write your post content here… Markdown links and spoiler syntax are supported."
                  ariaLabel="Post content"
                  onChange={(json) => setContent(JSON.stringify(json))}
                  className="min-h-[480px]"
                />
              </div>
            ) : (
              <div className="px-6 py-4 prose max-w-none min-h-[480px]">
                {content ? (
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
                This will drive the template-aware editor once block content inputs are added.
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

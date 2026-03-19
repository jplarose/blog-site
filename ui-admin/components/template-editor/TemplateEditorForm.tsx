"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { templatesApi } from "@/lib/api";
import { createEmptyTemplateLayout, createTemplateBlock } from "@/lib/template-defaults";
import { insertBlock } from "@/lib/template-layout";
import type { LayoutTemplate, TemplateBlockKind, TemplateLayout } from "@/lib/template-schema";
import TemplateCanvasPreview from "@/components/template-editor/TemplateCanvasPreview";
import TemplateStructureEditor from "@/components/template-editor/TemplateStructureEditor";

type TabType = "canvas" | "json";

const AVAILABLE_BLOCKS: { kind: TemplateBlockKind; label: string }[] = [
  { kind: "title", label: "Title" },
  { kind: "richText", label: "Rich Text" },
  { kind: "image", label: "Image" },
  { kind: "gallery", label: "Gallery" },
  { kind: "column", label: "Columns" },
  { kind: "container", label: "Container" },
];

interface TemplateEditorFormProps {
  mode: "create" | "edit";
  initialTemplate?: LayoutTemplate | null;
}

export default function TemplateEditorForm({
  mode,
  initialTemplate = null,
}: TemplateEditorFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("canvas");
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [isDefault, setIsDefault] = useState(initialTemplate?.isDefault ?? false);
  const [layout, setLayout] = useState<TemplateLayout>(
    initialTemplate?.layout ?? createEmptyTemplateLayout(),
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function addBlock(kind: TemplateBlockKind) {
    const block = createTemplateBlock(kind);
    setLayout((currentLayout) => insertBlock(currentLayout, block, selectedParentId));
  }

  async function handleSaveTemplate() {
    if (!name.trim()) {
      setSaveError("Template name is required.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
        layout,
      };

      const savedTemplate =
        mode === "edit" && initialTemplate
          ? await templatesApi.update(initialTemplate.id, payload)
          : await templatesApi.create(payload);

      router.push(`/templates/${savedTemplate.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save template.");
    } finally {
      setIsSaving(false);
    }
  }

  const pageTitle = mode === "edit" ? "Edit Template" : "New Template";
  const primaryActionLabel =
    mode === "edit" ? (isSaving ? "Saving..." : "Update Template") : isSaving ? "Saving..." : "Save Template";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates" className="text-sm text-gray-500 hover:text-gray-700">
          ← Templates
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <input
            type="text"
            placeholder="Template name…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-lg font-semibold placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Short description…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Block Palette</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {AVAILABLE_BLOCKS.map((block) => (
                <button
                  key={block.kind}
                  type="button"
                  onClick={() => addBlock(block.kind)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                >
                  + {block.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Blocks insert at the current target, and the structure panel supports drag sorting.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex border-b border-gray-200">
              {(["canvas", "json"] as const).map((tabId) => (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === tabId
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tabId === "canvas" ? "Canvas" : "Layout JSON"}
                </button>
              ))}
            </div>

            {activeTab === "canvas" ? (
              <div className="min-h-[480px] bg-slate-100 p-6">
                <TemplateCanvasPreview layout={layout} />
              </div>
            ) : (
              <div className="min-h-[480px] bg-slate-950 p-4">
                <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-200">
                  {JSON.stringify(layout, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Settings</h2>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Set as default template</span>
            </label>

            <div className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Canvas</p>
              <p className="mt-1">Width: {layout.canvas.width}px</p>
              <p>Min row height: {layout.canvas.minRowHeight}px</p>
              <p>Root blocks: {layout.rootBlockIds.length}</p>
            </div>

            {saveError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {saveError}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Link
                href="/templates"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => void handleSaveTemplate()}
                disabled={isSaving}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-60"
              >
                {primaryActionLabel}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 text-sm">Structure</h2>
            <TemplateStructureEditor
              layout={layout}
              selectedParentId={selectedParentId}
              onLayoutChange={setLayout}
              onSelectParent={setSelectedParentId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

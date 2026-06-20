"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { templatesApi } from "@/lib/api";
import { createEmptyTemplateLayout } from "@/lib/template-defaults";
import {
  removeBlock,
  updateBlockLabel,
  updateBlockProps,
  updateBlockSize,
  updateBlockStyle,
} from "@/lib/template-layout";
import type {
  LayoutTemplate,
  TemplateBlockSize,
  TemplateBlockStyle,
  TemplateLayout,
  TemplateSpacing,
  TemplateTextAlign,
  TemplateWidthMode,
} from "@/lib/template-schema";

const TemplateCanvasEditor = dynamic(
  () => import("@/components/template-editor/TemplateCanvasEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
        Loading canvas editor…
      </div>
    ),
  },
);

interface TemplateEditorFormProps {
  mode: "create" | "edit";
  initialTemplate?: LayoutTemplate | null;
}

export default function TemplateEditorForm({
  mode,
  initialTemplate = null,
}: TemplateEditorFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [isDefault, setIsDefault] = useState(initialTemplate?.isDefault ?? false);
  const [layout, setLayout] = useState<TemplateLayout>(
    initialTemplate?.layout ?? createEmptyTemplateLayout(),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    mode === "edit"
      ? isSaving
        ? "Saving..."
        : "Update Template"
      : isSaving
        ? "Saving..."
        : "Save Template";

  function handleBlockLabelChange(blockId: string, label: string) {
    setLayout((currentLayout) => updateBlockLabel(currentLayout, blockId, label));
  }

  function handleBlockSizeChange(
    blockId: string,
    currentSize: TemplateBlockSize | undefined,
    field: keyof TemplateBlockSize,
    value?: number | TemplateWidthMode,
  ) {
    const nextSize: TemplateBlockSize = {
      ...(currentSize ?? {}),
    };

    if (value === undefined) {
      delete nextSize[field];
    } else {
      nextSize[field] = value as never;
    }

    setLayout((currentLayout) => updateBlockSize(currentLayout, blockId, nextSize));
  }

  function handleBlockStyleChange(
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: keyof TemplateBlockStyle,
    value?: number | string | TemplateTextAlign,
  ) {
    const nextStyle: TemplateBlockStyle = {
      ...(currentStyle ?? {}),
    };

    if (value === undefined) {
      delete nextStyle[field];
    } else {
      nextStyle[field] = value as never;
    }

    setLayout((currentLayout) => updateBlockStyle(currentLayout, blockId, nextStyle));
  }

  function handleBlockPropsChange(blockId: string, nextProps: Record<string, unknown> | undefined) {
    setLayout((currentLayout) => updateBlockProps(currentLayout, blockId, nextProps));
  }

  function handleBlockSpacingChange(
    blockId: string,
    currentStyle: TemplateBlockStyle | undefined,
    field: "padding" | "margin",
    side: keyof TemplateSpacing,
    value?: number,
  ) {
    const currentSpacing = currentStyle?.[field];
    const nextSpacing: TemplateSpacing = {
      top: currentSpacing?.top,
      right: currentSpacing?.right,
      bottom: currentSpacing?.bottom,
      left: currentSpacing?.left,
    };

    if (value === undefined) {
      delete nextSpacing[side];
    } else {
      nextSpacing[side] = value;
    }

    setLayout((currentLayout) =>
      updateBlockStyle(currentLayout, blockId, {
        ...(currentStyle ?? {}),
        [field]: nextSpacing,
      }),
    );
  }

  function handleRemoveBlock(blockId: string) {
    setLayout((currentLayout) => removeBlock(currentLayout, blockId));
    setSelectedBlockId((currentSelectedBlockId) =>
      currentSelectedBlockId === blockId ? null : currentSelectedBlockId,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_45%,#eff6ff_100%)] p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link href="/templates" className="inline-flex text-sm text-slate-500 hover:text-slate-700">
            ← Templates
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{pageTitle}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Build the layout as if you are arranging a real page. Select any block on the canvas
              to edit it in place.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/templates"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void handleSaveTemplate()}
            disabled={isSaving}
            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Template Name
            </label>
            <input
              type="text"
              placeholder="Sunday feature layout"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Template Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe the story structure this template is designed for."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">Use as default template</span>
              <span className="block text-sm text-slate-500">
                New posts start with this layout unless another template is chosen.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-3 gap-3 text-center">
            <StatCard label="Canvas" value={`${layout.canvas.width}px`} />
            <StatCard label="Blocks" value={String(Object.keys(layout.blocks).length)} />
            <StatCard label="Sections" value={String(layout.rootBlockIds.length)} />
          </div>
        </div>
      </section>

      <TemplateCanvasEditor
        layout={layout}
        selectedBlockId={selectedBlockId}
        onLayoutChange={setLayout}
        onSelectBlock={setSelectedBlockId}
        onUpdateBlockLabel={handleBlockLabelChange}
        onUpdateBlockProps={handleBlockPropsChange}
        onUpdateBlockSize={handleBlockSizeChange}
        onUpdateBlockStyle={handleBlockStyleChange}
        onUpdateBlockSpacing={handleBlockSpacingChange}
        onRemoveBlock={handleRemoveBlock}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

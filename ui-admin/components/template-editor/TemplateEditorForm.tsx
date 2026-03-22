"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { templatesApi } from "@/lib/api";
import { createEmptyTemplateLayout } from "@/lib/template-defaults";
import { updateBlockSize, updateBlockStyle } from "@/lib/template-layout";
import type {
  LayoutTemplate,
  TemplateBlockSize,
  TemplateBlockStyle,
  TemplateSpacing,
  TemplateTextAlign,
  TemplateLayout,
  TemplateWidthMode,
} from "@/lib/template-schema";

const TemplateCanvasEditor = dynamic(
  () => import("@/components/template-editor/TemplateCanvasEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
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
    mode === "edit" ? (isSaving ? "Saving..." : "Update Template") : isSaving ? "Saving..." : "Save Template";
  const selectedBlock = selectedBlockId ? layout.blocks[selectedBlockId] : null;

  function handleBlockSizeChange(field: keyof TemplateBlockSize, value?: number | TemplateWidthMode) {
    if (!selectedBlockId) {
      return;
    }

    const nextSize: TemplateBlockSize = {
      ...(selectedBlock?.size ?? {}),
    };

    if (value === undefined || value === "") {
      delete nextSize[field];
    } else {
      nextSize[field] = value as never;
    }

    setLayout((currentLayout) => updateBlockSize(currentLayout, selectedBlockId, nextSize));
  }

  function handleBlockStyleChange(
    field: keyof TemplateBlockStyle,
    value?: number | string | TemplateTextAlign,
  ) {
    if (!selectedBlockId) {
      return;
    }

    const nextStyle: TemplateBlockStyle = {
      ...(selectedBlock?.style ?? {}),
    };

    if (value === undefined || value === "") {
      delete nextStyle[field];
    } else {
      nextStyle[field] = value as never;
    }

    setLayout((currentLayout) => updateBlockStyle(currentLayout, selectedBlockId, nextStyle));
  }

  function handleBlockSpacingChange(
    field: "padding" | "margin",
    side: keyof TemplateSpacing,
    value?: number,
  ) {
    if (!selectedBlockId) {
      return;
    }

    const currentSpacing = selectedBlock?.style?.[field];
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

    const nextStyle: TemplateBlockStyle = {
      ...(selectedBlock?.style ?? {}),
      [field]: nextSpacing,
    };

    setLayout((currentLayout) => updateBlockStyle(currentLayout, selectedBlockId, nextStyle));
  }

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

          <TemplateCanvasEditor
            layout={layout}
            selectedBlockId={selectedBlockId}
            onLayoutChange={setLayout}
            onSelectBlock={setSelectedBlockId}
          />
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
              <p className="font-medium text-gray-900">Layout Snapshot</p>
              <p className="mt-1">Width: {layout.canvas.width}px</p>
              <p>Blocks on page: {Object.keys(layout.blocks).length}</p>
              <p>Top-level sections: {layout.rootBlockIds.length}</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Block Sizing</p>
              {selectedBlock ? (
                <div className="mt-3 space-y-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                    {selectedBlock.label} · {selectedBlock.kind}
                  </p>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-gray-500">Width Mode</span>
                    <select
                      value={selectedBlock.size?.widthMode ?? ""}
                      onChange={(event) =>
                        handleBlockSizeChange(
                          "widthMode",
                          (event.target.value || undefined) as TemplateWidthMode | undefined,
                        )
                      }
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Auto</option>
                      <option value="full">Full Width</option>
                      <option value="fixed">Fixed Pixels</option>
                      <option value="fraction">Percentage</option>
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-gray-500">
                      {selectedBlock.size?.widthMode === "fraction" ? "Width Percentage" : "Width Value"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={selectedBlock.size?.widthMode === "fraction" ? 100 : undefined}
                      value={selectedBlock.size?.widthValue ?? ""}
                      onChange={(event) =>
                        handleBlockSizeChange("widthValue", parseOptionalNumber(event.target.value))
                      }
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder={
                        selectedBlock.size?.widthMode === "fraction" ? "e.g. 50" : "e.g. 320"
                      }
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Min Height</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedBlock.size?.minHeight ?? ""}
                        onChange={(event) =>
                          handleBlockSizeChange("minHeight", parseOptionalNumber(event.target.value))
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. 180"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Max Width</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedBlock.size?.maxWidth ?? ""}
                        onChange={(event) =>
                          handleBlockSizeChange("maxWidth", parseOptionalNumber(event.target.value))
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. 720"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Select a block directly on the page to control its width and height.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Block Style</p>
              {selectedBlock ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Gap</span>
                      <input
                        type="number"
                        min={0}
                        value={selectedBlock.style?.gap ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange("gap", parseOptionalNumber(event.target.value))
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. 16"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Text Align</span>
                      <select
                        value={selectedBlock.style?.textAlign ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange(
                            "textAlign",
                            (event.target.value || undefined) as TemplateTextAlign | undefined,
                          )
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Default</option>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Background</span>
                      <input
                        type="text"
                        value={selectedBlock.style?.backgroundColor ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange("backgroundColor", event.target.value || undefined)
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="#ffffff"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Text Color</span>
                      <input
                        type="text"
                        value={selectedBlock.style?.textColor ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange("textColor", event.target.value || undefined)
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="#0f172a"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Radius</span>
                      <input
                        type="number"
                        min={0}
                        value={selectedBlock.style?.borderRadius ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange("borderRadius", parseOptionalNumber(event.target.value))
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="24"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Border</span>
                      <input
                        type="number"
                        min={0}
                        value={selectedBlock.style?.borderWidth ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange("borderWidth", parseOptionalNumber(event.target.value))
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="1"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-500">Border Color</span>
                      <input
                        type="text"
                        value={selectedBlock.style?.borderColor ?? ""}
                        onChange={(event) =>
                          handleBlockStyleChange("borderColor", event.target.value || undefined)
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="#cbd5e1"
                      />
                    </label>
                  </div>

                  <SpacingEditor
                    label="Padding"
                    spacing={selectedBlock.style?.padding}
                    onChange={(side, value) => handleBlockSpacingChange("padding", side, value)}
                  />

                  <SpacingEditor
                    label="Margin"
                    spacing={selectedBlock.style?.margin}
                    onChange={(side, value) => handleBlockSpacingChange("margin", side, value)}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Select a block on the page to adjust spacing, color, alignment, and borders.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-slate-950 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Layout JSON
              </p>
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
                {JSON.stringify(layout, null, 2)}
              </pre>
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
        </div>
      </div>
    </div>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function SpacingEditor({
  label,
  spacing,
  onChange,
}: {
  label: string;
  spacing?: TemplateSpacing;
  onChange: (side: keyof TemplateSpacing, value?: number) => void;
}) {
  const fields: Array<{ key: keyof TemplateSpacing; label: string }> = [
    { key: "top", label: "Top" },
    { key: "right", label: "Right" },
    { key: "bottom", label: "Bottom" },
    { key: "left", label: "Left" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <label key={field.key} className="block space-y-1">
            <span className="text-xs font-medium text-gray-500">{field.label}</span>
            <input
              type="number"
              min={0}
              value={spacing?.[field.key] ?? ""}
              onChange={(event) => onChange(field.key, parseOptionalNumber(event.target.value))}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="0"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

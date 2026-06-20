"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { templatesApi } from "@/lib/api";
import type { TemplateSummary } from "@/lib/template-schema";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTemplates() {
      try {
        const nextTemplates = await templatesApi.list();
        if (!isActive) {
          return;
        }

        setTemplates(nextTemplates);
        setErrorMessage(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load templates.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Layout Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage reusable layout templates for different post types
          </p>
        </div>
        <Link
          href="/templates/new"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Template
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-400">
            <p className="text-sm">Loading templates…</p>
          </div>
        ) : null}

        {!isLoading && templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-400">
            <p className="text-sm">No templates yet.</p>
            <Link
              href="/templates/new"
              className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
            >
              Create your first template →
            </Link>
          </div>
        ) : null}

        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/templates/${template.id}`}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {template.description || "No description yet."}
                </p>
              </div>
              {template.isDefault ? (
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  Default
                </span>
              ) : null}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-500">Posts</dt>
                <dd className="mt-1 font-semibold text-gray-900">{template.postCount ?? 0}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-500">Categories</dt>
                <dd className="mt-1 font-semibold text-gray-900">{template.categoryCount ?? 0}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-gray-400">
              Updated {new Date(template.updatedAt).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Templates are saved as structured layout JSON so each post or category can reuse the
        same block arrangement consistently.
      </p>
    </div>
  );
}

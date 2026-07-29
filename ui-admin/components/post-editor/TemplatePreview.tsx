"use client";

import { useMemo } from "react";

import { richTextToHtml } from "@/components/rte/toHtml";
import type { CatalogTemplate } from "@/lib/catalog";
import { renderTemplateHtml, type TemplateTokenValues } from "@/lib/template-tokens";

interface TemplatePreviewFields {
  title: string;
  content: string;
  excerpt: string;
  featuredImageUrl: string;
  category: string;
  tags: string[];
}

interface TemplatePreviewProps {
  template: CatalogTemplate | null;
  isLoading: boolean;
  error: string | null;
  fields: TemplatePreviewFields;
}

/**
 * Renders the selected catalog template with the post's current field
 * values substituted in, inside a fully sandboxed iframe (no `allow-scripts`,
 * no `allow-same-origin`) so unsanitized draft HTML cannot execute in the
 * admin app. The API sanitizes rich content at save time (#34); this is a
 * client-side preview only.
 */
export default function TemplatePreview({ template, isLoading, error, fields }: TemplatePreviewProps) {
  const srcDoc = useMemo(() => {
    if (!template) {
      return "";
    }

    const tokenValues: TemplateTokenValues = {
      title: fields.title,
      content: richTextToHtml(fields.content),
      excerpt: fields.excerpt,
      featuredImage: fields.featuredImageUrl,
      publishedAt: "",
      category: fields.category,
      tags: fields.tags.join(", "),
    };

    const renderedHtml = renderTemplateHtml(template.htmlStructure, tokenValues);

    return `<!doctype html><html><head><meta charset="utf-8" /><style>${template.cssStyles}</style></head><body>${renderedHtml}</body></html>`;
  }, [template, fields]);

  if (isLoading) {
    return <p className="px-6 py-4 text-sm text-gray-500">Loading preview…</p>;
  }

  if (error) {
    return (
      <div className="mx-6 my-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!template) {
    return (
      <p className="px-6 py-4 text-sm text-gray-400 italic">
        Select a template above to preview your post.
      </p>
    );
  }

  return (
    <iframe
      title="Template preview"
      sandbox=""
      srcDoc={srcDoc}
      className="h-[600px] w-full border-0"
    />
  );
}

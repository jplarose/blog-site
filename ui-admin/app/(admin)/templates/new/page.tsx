"use client";

import { useState } from "react";
import Link from "next/link";

type TabType = "html" | "css" | "preview";

const defaultHtml = `<article class="post">
  <header class="post-header">
    <h1 class="post-title">{{title}}</h1>
    <div class="post-meta">
      <span>{{publishedAt}}</span>
      <span>{{category}}</span>
    </div>
  </header>
  <div class="post-content">
    {{content}}
  </div>
</article>`;

const defaultCss = `.post { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
.post-title { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
.post-meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
.post-content { font-size: 1.1rem; line-height: 1.75; }`;

export default function NewTemplatePage() {
  const [activeTab, setActiveTab] = useState<TabType>("html");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [htmlStructure, setHtmlStructure] = useState(defaultHtml);
  const [cssStyles, setCssStyles] = useState(defaultCss);
  const [isDefault, setIsDefault] = useState(false);

  const tabs: { id: TabType; label: string }[] = [
    { id: "html", label: "HTML Structure" },
    { id: "css", label: "CSS Styles" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates" className="text-sm text-gray-500 hover:text-gray-700">
          ← Templates
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Template</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <input
            type="text"
            placeholder="Template name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-lg font-semibold placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Short description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "html" && (
              <textarea
                value={htmlStructure}
                onChange={(e) => setHtmlStructure(e.target.value)}
                rows={20}
                className="w-full px-4 py-3 font-mono text-sm focus:outline-none resize-none"
              />
            )}

            {activeTab === "css" && (
              <textarea
                value={cssStyles}
                onChange={(e) => setCssStyles(e.target.value)}
                rows={20}
                className="w-full px-4 py-3 font-mono text-sm focus:outline-none resize-none"
              />
            )}

            {activeTab === "preview" && (
              <div className="p-6 min-h-[480px]">
                <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
                <div
                  dangerouslySetInnerHTML={{
                    __html: htmlStructure
                      .replace(/\{\{title\}\}/g, name || "Sample Post Title")
                      .replace(/\{\{content\}\}/g, "<p>Sample post content goes here…</p>")
                      .replace(/\{\{publishedAt\}\}/g, new Date().toLocaleDateString())
                      .replace(/\{\{category\}\}/g, "Technology")
                      .replace(/\{\{tags\}\}/g, "TypeScript, Next.js"),
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Settings</h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Set as default template</span>
            </label>

            <div className="flex gap-2 pt-2">
              <Link
                href="/templates"
                className="flex-1 text-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 text-sm">Available Variables</h2>
            <ul className="space-y-1 text-xs text-gray-600 font-mono">
              {["{{title}}", "{{content}}", "{{excerpt}}", "{{publishedAt}}", "{{category}}", "{{tags}}", "{{featuredImage}}"].map((v) => (
                <li key={v} className="bg-gray-50 rounded px-2 py-1">{v}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

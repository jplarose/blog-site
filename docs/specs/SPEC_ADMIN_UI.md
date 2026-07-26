# Spec: Admin UI — Fixed Template Catalog

## Target Technology
- Next.js (App Router) + TypeScript
- HeroUI component library for all UI primitives
- Tailwind CSS for layout and spacing
- A rich text editor for post body authoring (e.g. Tiptap) producing sanitized HTML — the specific editor and its extension set are an implementation detail, not fixed by this spec
- All admin routes are a secured, single-owner workspace: protected by a JWT-backed session issued by the shared external Auth API, held in an HttpOnly cookie by the Next.js BFF (see Auth Gate below). There is no users/roles UI — one authenticated owner.

## Confidence Notes for Agent
- App Router uses `app/` directory with `page.tsx`, `layout.tsx`, `loading.tsx` files
- Server Components are the default in App Router — components that use hooks, browser APIs, or event handlers must have `'use client'` at the top
- Data fetching in Server Components uses `fetch` directly or calls server-side data functions — no `useEffect` for initial data
- HeroUI components are client-side; wrap them in a client boundary if needed
- Exact routes, request/response contracts for the protected admin APIs, and the finalized post-editor / dashboard UX are tracked in GitHub issues **#35–#38** and are not fully fixed yet. Where this spec would need to invent a contract those issues haven't settled, it stays high-level and defers to the issue rather than prescribing one.

---

## Directory Structure

```
app/
  admin/
    layout.tsx                  — admin shell layout with nav; auth gate here
    page.tsx                    — admin dashboard (30-day analytics summary)
    categories/
      page.tsx                  — category list + create
      [id]/
        edit/page.tsx           — edit category
    tags/
      page.tsx                  — tag list + create
    posts/
      page.tsx                  — post list, filterable by status
      new/page.tsx              — create post (title, category, catalog template selection)
      [id]/
        edit/page.tsx           — post editor: title, body, category, tags, catalog template, schedule
  preview/
    [id]/
      page.tsx                  — draft preview (admin-gated), rendered against the post's selected catalog template

components/
  post-editor/
    PostEditor.tsx               — top-level editor shell (client): title, rich text body, metadata
    TemplatePicker.tsx           — catalog template selector + preview thumbnail (client)
    RichTextEditor.tsx           — rich text body editor wrapper (client)
  analytics/
    SummaryCards.tsx             — views / unique visitors / post-state counts
    DailyViewsChart.tsx          — daily views chart
    TopPostsTable.tsx            — top posts table

lib/
  api.ts                        — typed fetch wrappers for the .NET backend
  auth.ts                       — session helpers for the Next.js BFF (JWT cookie)
  types.ts                      — shared TypeScript types (mirrors backend models)

hooks/
  useImageUpload.ts             — upload hook (client)
```

There is no `components/template-editor/`, no block/canvas editor, and no per-post "template content" authoring form — those belonged to the retired editable-template system.

---

## Shared Types

```typescript
// lib/types.ts

export interface LayoutTemplate {
  id: number;
  templateKey: string;      // 'article' | 'feature' | 'photo-essay'
  name: string;
  description: string;
  // htmlStructure / cssStyles are used by the preview renderer; not editable in the UI
  htmlStructure: string;
  cssStyles: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;            // sanitized rich HTML body — not a field-value map
  excerpt?: string;
  featuredImageUrl?: string;
  status: 'Draft' | 'Scheduled' | 'Published' | 'Archived';
  categoryId?: number;
  templateId?: number;        // explicit selection from the fixed catalog
  publishedAt?: string;
  scheduledAt?: string;
}
```

There is no `TemplateDefinition`, `TemplateBlock`, or `TemplateField` type — the block/field template model was retired. Templates are a flat, read-only catalog resource identified by `templateId`/`templateKey`.

---

## API Client

All communication with the .NET backend goes through this module. Never call `fetch` directly in components.

```typescript
// lib/api.ts

const BASE_URL = process.env.API_BASE_URL!;

interface ApiOptions {
  method?: string;
  body?: unknown;
}

// The session JWT lives in an HttpOnly cookie managed by the BFF; server-side
// calls forward it as a Bearer token. Client components never see the token directly.
async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getSessionToken(); // reads the HttpOnly cookie server-side

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: 'UNKNOWN', message: response.statusText }));
    throw new ApiError(response.status, error.code, error.message, error.errors);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  templates: {
    // Read-only catalog — no create/update/delete methods exist.
    list: () => apiFetch<LayoutTemplate[]>('/api/templates'),
    get: (id: number) => apiFetch<LayoutTemplate>(`/api/templates/${id}`),
  },

  categories: {
    list: () => apiFetch<Category[]>('/api/categories'),
    create: (data: { name: string; description?: string }) =>
      apiFetch<{ id: number; slug: string }>('/api/categories', { method: 'POST', body: data }),
    update: (id: number, data: { name: string; description?: string }) =>
      apiFetch<void>(`/api/categories/${id}`, { method: 'PUT', body: data }),
    delete: (id: number) => apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' }),
  },

  posts: {
    list: (params?: { status?: string; categoryId?: number }) =>
      apiFetch<Post[]>(`/api/posts${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
    get: (id: number) => apiFetch<Post>(`/api/posts/${id}`),
    create: (data: { title: string; categoryId?: number; templateId?: number }) =>
      apiFetch<{ id: number }>('/api/posts', { method: 'POST', body: data }),
    update: (id: number, data: Partial<Post>) =>
      apiFetch<void>(`/api/posts/${id}`, { method: 'PUT', body: data }),
    publish: (id: number) => apiFetch<{ status: string }>(`/api/posts/${id}/publish`, { method: 'POST' }),
    delete: (id: number) => apiFetch<void>(`/api/posts/${id}`, { method: 'DELETE' }),
  },
};
```

Full endpoint contracts (including analytics): see the Backend spec and issues #32–#34.

---

## Admin Layout + Auth Gate

```tsx
// app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/auth';

// Session is a JWT issued by the shared external Auth API, stored in an
// HttpOnly cookie by this Next.js app (the BFF). Replace with the finalized
// login/refresh flow from issue #35 — this gate only checks presence/validity.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = await getSessionToken();
  if (!token) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 bg-default-50">
        {children}
      </main>
    </div>
  );
}
```

There are no roles or permission levels to check — a valid session is the single admin owner. Detailed login/logout/refresh flow: issue #35.

---

## Post Editor

The post editor is a title + rich-text body form, plus metadata (category, tags, schedule) and a **catalog template picker** — not a template builder. There is no drag-and-drop block canvas, no per-block field authoring, and no "add block" palette.

```tsx
// app/admin/posts/[id]/edit/page.tsx
import { api } from '@/lib/api';
import { PostEditor } from '@/components/post-editor/PostEditor';

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const post = await api.posts.get(Number(params.id));
  const templates = await api.templates.list(); // the fixed 3-row catalog

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Edit Post</h1>
      <PostEditor post={post} templates={templates} />
    </div>
  );
}
```

```tsx
// components/post-editor/PostEditor.tsx
'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { Post, LayoutTemplate } from '@/lib/types';
import { api } from '@/lib/api';
import { RichTextEditor } from './RichTextEditor';
import { TemplatePicker } from './TemplatePicker';

interface Props {
  post: Post;
  templates: LayoutTemplate[];
}

export function PostEditor({ post, templates }: Props) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [templateId, setTemplateId] = useState(post.templateId);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.posts.update(post.id, { title, content, templateId });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await api.posts.update(post.id, { title, content, templateId });
      await api.posts.publish(post.id);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Title input — implementation detail, any text input component */}

      {/* Catalog template selection — pick one of the fixed three, cannot create/edit */}
      <TemplatePicker
        templates={templates}
        selectedId={templateId}
        onSelect={setTemplateId}
      />

      {/* Rich text body — produces sanitized HTML, stored as posts.content */}
      <RichTextEditor value={content} onChange={setContent} />

      <div className="flex items-center gap-3 pt-4 border-t border-default-200">
        <div className="flex-1" />
        <Button variant="flat" onPress={handleSave} isLoading={isSaving}>
          Save Draft
        </Button>
        <Button color="primary" onPress={handlePublish} isLoading={isPublishing}>
          {post.status === 'Published' ? 'Update' : 'Publish'}
        </Button>
      </div>
    </div>
  );
}
```

### Template Picker

Presents the three fixed catalog templates (name, description, and a small preview) for the admin to choose from — a selector, not an editor.

```tsx
// components/post-editor/TemplatePicker.tsx
'use client';

import { Card, CardBody, RadioGroup, Radio } from '@heroui/react';
import { LayoutTemplate } from '@/lib/types';

interface Props {
  templates: LayoutTemplate[];
  selectedId?: number;
  onSelect: (id: number) => void;
}

export function TemplatePicker({ templates, selectedId, onSelect }: Props) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-default-500 uppercase tracking-wide">Template</h3>
      <RadioGroup value={String(selectedId ?? '')} onValueChange={(v) => onSelect(Number(v))}>
        {templates.map(t => (
          <Radio key={t.id} value={String(t.id)}>
            <Card>
              <CardBody>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-default-500">{t.description}</p>
              </CardBody>
            </Card>
          </Radio>
        ))}
      </RadioGroup>
    </section>
  );
}
```

There is no way, in this UI, to add/remove/reorder blocks, edit a template's HTML/CSS, or set a category's default template — all removed with the editable-template system. Detailed picker/preview UX: issue #36.

---

## Image Upload

The admin BFF proxies image uploads to SeaweedFS directly (unchanged behavior from before the catalog reset — see the SQL/API SeaweedFS configuration). Uploaded URLs are used for `featuredImageUrl` and for images inserted into the rich text body. Route contract details: issue #37.

---

## Preview Route

Renders the post against its **currently selected** catalog template (there is no "live vs. snapshot" distinction to worry about — the catalog never changes underneath a post). Admin-gated.

```tsx
// app/preview/[id]/page.tsx
import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { renderTemplate } from '@/lib/render'; // shared with the public renderer, see Public UI spec

export default async function PreviewPage({ params }: { params: { id: string } }) {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  const post = await api.posts.get(Number(params.id));
  const template = post.templateId ? await api.templates.get(post.templateId) : null;

  return (
    <div>
      <div className="bg-warning-50 border-b border-warning-200 px-4 py-2 text-sm text-warning-700">
        Preview — this post is not published.
      </div>
      {template && <div dangerouslySetInnerHTML={{ __html: renderTemplate(template, post) }} />}
    </div>
  );
}
```

---

## Analytics Dashboard

The admin home page (`app/admin/page.tsx`) shows a 30-day performance summary: total views, unique visitors, post-state counts, a daily views chart, and a top-posts table, backed by `GET /api/analytics/summary`. Exact widget composition and chart library: issue #38.

---

## What the Agent Must NOT Do

- Do not build a template editor, block canvas, block palette, or per-block properties panel — templates are a fixed, read-only catalog; there is no template CRUD UI
- Do not build a per-post "template content" authoring form (one input per template field) — posts have a single rich-text body (`content`) plus ordinary metadata fields
- Do not add a "default template" control to the category create/edit UI — categories do not carry a template default
- Do not put `'use client'` on page.tsx files that only fetch data and pass to client components — keep the data-fetching layer as Server Components
- Do not call `fetch` directly inside components — use `lib/api.ts`
- Do not store the admin session token anywhere accessible to client-side JavaScript — it lives only in an HttpOnly cookie handled by the BFF
- Do not use `dangerouslySetInnerHTML` for post body content without it having passed through server-side sanitization first (the backend sanitizes on write; do not bypass by rendering unsanitized client state)
- Do not invent finalized routes, DTOs, or dashboard widget contracts beyond what is stated here — reference the relevant issue (#35–#38) instead

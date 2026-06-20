# Spec: Admin UI — Blog Template System
## Target Technology
- Next.js (App Router) + TypeScript
- HeroUI component library for all UI primitives
- Tailwind CSS for layout and spacing
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop block reordering
- `react-resizable-panels` for two-column block resizing
- Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`) for rich text editing
- All admin routes protected by session check (MVP: static bearer token)

## Confidence Notes for Agent
- App Router uses `app/` directory with `page.tsx`, `layout.tsx`, `loading.tsx` files
- Server Components are the default in App Router — components that use hooks, browser APIs, or event handlers must have `'use client'` at the top
- Data fetching in Server Components uses `fetch` directly or calls server-side data functions — no `useEffect` for initial data
- HeroUI components are client-side; wrap them in a client boundary if needed
- `@dnd-kit` requires `'use client'` on any component that uses its hooks

## Required Packages

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install react-resizable-panels
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder
npm install isomorphic-dompurify
npm install @types/dompurify --save-dev
```

---

## Directory Structure

```
app/
  admin/
    layout.tsx                  — admin shell layout with nav; auth gate here
    page.tsx                    — admin dashboard (redirect to /admin/posts)
    categories/
      page.tsx                  — category list + create
      [id]/
        edit/page.tsx           — edit category
    templates/
      page.tsx                  — template list
      new/page.tsx              — create template
      [id]/
        edit/page.tsx           — edit template
    posts/
      page.tsx                  — post list
      new/page.tsx              — create post (category → template → stub)
      [id]/
        edit/page.tsx           — post content editor
  preview/
    [id]/
      page.tsx                  — draft preview (admin-gated, uses live template)

components/
  template-editor/
    TemplateEditor.tsx          — top-level editor shell (client)
    BlockCanvas.tsx             — sortable block list (client)
    SortableBlock.tsx           — individual draggable block (client)
    BlockPalette.tsx            — palette of addable block types (client)
    BlockPropertiesPanel.tsx    — right panel; edits selected block styles/fields (client)
    blocks/
      TwoColumnBlock.tsx        — resizable two-column block preview (client)
  post-editor/
    PostContentEditor.tsx       — post field filling form (client)
    fields/
      TextField.tsx
      RichTextField.tsx
      ImageField.tsx
      VideoUrlField.tsx
      TagListField.tsx
  rich-text/
    RichTextEditor.tsx          — Tiptap editor wrapper (client)
    EditorToolbar.tsx           — formatting toolbar (client)

lib/
  api.ts                        — typed fetch wrappers for .NET backend
  auth.ts                       — getSession for Next.js (MVP static token)
  types.ts                      — shared TypeScript types (mirrors backend models)
  tiptap-renderer.ts            — server-side generateHTML utility

hooks/
  useImageUpload.ts             — upload hook (client)
  useTemplateEditor.ts          — template editor state management (client)
```

---

## Shared Types

```typescript
// lib/types.ts

export type FieldType = 'text' | 'rich-text' | 'image' | 'video-url' | 'tag-list';
export type BlockType = 'hero' | 'text-body' | 'image-grid' | 'video-embed' | 'two-column' | 'callout';

export interface TemplateField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  maxLength?: number;
  aspectRatio?: string;
}

export interface BlockStyles {
  padding: 'none' | 'compact' | 'normal' | 'wide';
  background: 'default' | 'muted' | 'accent';
  columns?: number;
  alignment: 'left' | 'center' | 'right';
}

export interface TemplateBlock {
  id: string;
  type: BlockType;
  order: number;
  fields: TemplateField[];
  styles: BlockStyles;
}

export interface TemplateDefinition {
  blocks: TemplateBlock[];
}

export interface Template {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  definition: TemplateDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Post {
  id: string;
  templateId: string;
  categoryId: string;
  title: string;
  slug: string;
  content: Record<string, string>;
  templateSnapshot?: TemplateDefinition;
  published: boolean;
  publishedAt?: string;
}
```

---

## API Client

All communication with the .NET backend goes through this module. Never call `fetch` directly in components.

```typescript
// lib/api.ts

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY!;

interface ApiOptions {
  method?: string;
  body?: unknown;
  adminAuth?: boolean;
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.adminAuth) {
    headers['Authorization'] = `Bearer ${ADMIN_KEY}`;
  }

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

// Categories
export const api = {
  categories: {
    list: () => apiFetch<Category[]>('/api/categories'),
    create: (data: { name: string; description?: string }) =>
      apiFetch<{ id: string; slug: string }>('/api/categories', { method: 'POST', body: data, adminAuth: true }),
    update: (id: string, data: { name: string; description?: string }) =>
      apiFetch<void>(`/api/categories/${id}`, { method: 'PUT', body: data, adminAuth: true }),
    delete: (id: string) =>
      apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE', adminAuth: true }),
  },

  templates: {
    list: (categoryId?: string) =>
      apiFetch<Template[]>(`/api/templates${categoryId ? `?categoryId=${categoryId}` : ''}`),
    get: (id: string) => apiFetch<Template>(`/api/templates/${id}`),
    create: (data: { categoryId: string; name: string; description?: string; definition: TemplateDefinition }) =>
      apiFetch<{ id: string }>('/api/templates', { method: 'POST', body: data, adminAuth: true }),
    update: (id: string, data: { name: string; description?: string; definition: TemplateDefinition }) =>
      apiFetch<void>(`/api/templates/${id}`, { method: 'PUT', body: data, adminAuth: true }),
    delete: (id: string) =>
      apiFetch<void>(`/api/templates/${id}`, { method: 'DELETE', adminAuth: true }),
  },

  posts: {
    list: (params?: { published?: boolean; categoryId?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<Post[]>(`/api/posts${qs ? `?${qs}` : ''}`, { adminAuth: true });
    },
    get: (id: string) => apiFetch<Post>(`/api/posts/${id}`, { adminAuth: true }),
    create: (data: { templateId: string; categoryId: string; title: string; slug?: string }) =>
      apiFetch<{ id: string }>('/api/posts', { method: 'POST', body: data, adminAuth: true }),
    updateContent: (id: string, data: { title: string; content: Record<string, string> }) =>
      apiFetch<void>(`/api/posts/${id}/content`, { method: 'PUT', body: data, adminAuth: true }),
    publish: (id: string) =>
      apiFetch<{ published: boolean }>(`/api/posts/${id}/publish`, { method: 'POST', adminAuth: true }),
    delete: (id: string) =>
      apiFetch<void>(`/api/posts/${id}`, { method: 'DELETE', adminAuth: true }),
  },
};
```

---

## Admin Layout + Auth Gate

```tsx
// app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';

// MVP: check for a session cookie or Authorization header set during login
// Replace this function when adding real auth
function isAdminAuthenticated(): boolean {
  // For MVP, check for a session cookie set at login
  const cookieStore = cookies();
  return cookieStore.get('admin_session')?.value === process.env.ADMIN_SESSION_TOKEN;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminAuthenticated()) {
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

---

## Template Editor

### State Management Hook

All template editor state lives in this hook. Components that modify the template call into this hook — they do not manage their own state.

```typescript
// hooks/useTemplateEditor.ts
'use client';

import { useState, useCallback } from 'react';
import { TemplateBlock, TemplateDefinition, TemplateField, BlockType } from '@/lib/types';
import { arrayMove } from '@dnd-kit/sortable';

// Default styles applied to a newly added block
const DEFAULT_STYLES = {
  padding: 'normal' as const,
  background: 'default' as const,
  alignment: 'left' as const,
};

// Default fields scaffolded for each block type
// Agents: add sensible defaults for each block type
const BLOCK_DEFAULTS: Record<BlockType, Omit<TemplateBlock, 'id' | 'order'>> = {
  'hero': {
    type: 'hero',
    fields: [
      { id: crypto.randomUUID(), type: 'image', label: 'Hero Image', required: false, aspectRatio: '16:9' },
      { id: crypto.randomUUID(), type: 'text', label: 'Headline', required: true, maxLength: 100 },
      { id: crypto.randomUUID(), type: 'text', label: 'Subheading', required: false, maxLength: 200 },
    ],
    styles: { ...DEFAULT_STYLES, alignment: 'center' },
  },
  'text-body': {
    type: 'text-body',
    fields: [
      { id: crypto.randomUUID(), type: 'rich-text', label: 'Body', required: true },
    ],
    styles: DEFAULT_STYLES,
  },
  'image-grid': {
    type: 'image-grid',
    fields: [
      { id: crypto.randomUUID(), type: 'image', label: 'Image 1', required: true },
      { id: crypto.randomUUID(), type: 'image', label: 'Image 2', required: false },
    ],
    styles: { ...DEFAULT_STYLES, columns: 2 },
  },
  'video-embed': {
    type: 'video-embed',
    fields: [
      { id: crypto.randomUUID(), type: 'video-url', label: 'Video URL', required: true },
      { id: crypto.randomUUID(), type: 'text', label: 'Caption', required: false },
    ],
    styles: DEFAULT_STYLES,
  },
  'two-column': {
    type: 'two-column',
    fields: [
      { id: crypto.randomUUID(), type: 'rich-text', label: 'Left Column', required: true },
      { id: crypto.randomUUID(), type: 'rich-text', label: 'Right Column', required: true },
    ],
    styles: { ...DEFAULT_STYLES, columns: 2 },
  },
  'callout': {
    type: 'callout',
    fields: [
      { id: crypto.randomUUID(), type: 'text', label: 'Callout Text', required: true, maxLength: 300 },
    ],
    styles: { ...DEFAULT_STYLES, background: 'accent' },
  },
};

export function useTemplateEditor(initial?: TemplateDefinition) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(
    initial?.blocks.slice().sort((a, b) => a.order - b.order) ?? []
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ?? null;

  const addBlock = useCallback((type: BlockType) => {
    const newBlock: TemplateBlock = {
      id: crypto.randomUUID(),
      order: blocks.length,
      ...BLOCK_DEFAULTS[type],
      // Re-generate field IDs when scaffolding a new block from defaults
      // This prevents multiple blocks of the same type sharing field IDs
      fields: BLOCK_DEFAULTS[type].fields.map(f => ({ ...f, id: crypto.randomUUID() })),
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, [blocks.length]);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev
      .filter(b => b.id !== id)
      .map((b, i) => ({ ...b, order: i }))
    );
    setSelectedBlockId(sel => sel === id ? null : sel);
  }, []);

  const reorderBlocks = useCallback((activeId: string, overId: string) => {
    setBlocks(prev => {
      const oldIndex = prev.findIndex(b => b.id === activeId);
      const newIndex = prev.findIndex(b => b.id === overId);
      return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
    });
  }, []);

  const updateBlockStyles = useCallback((blockId: string, styles: Partial<TemplateBlock['styles']>) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, styles: { ...b.styles, ...styles } } : b
    ));
  }, []);

  const addField = useCallback((blockId: string, type: TemplateField['type']) => {
    const newField: TemplateField = {
      id: crypto.randomUUID(),
      type,
      label: `New ${type} field`,
      required: false,
    };
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, fields: [...b.fields, newField] } : b
    ));
  }, []);

  const updateField = useCallback((blockId: string, fieldId: string, updates: Partial<TemplateField>) => {
    // CRITICAL: never update field.id here — only label, type, required, placeholder, etc.
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? { ...b, fields: b.fields.map(f => f.id === fieldId ? { ...f, ...updates, id: f.id } : f) }
        : b
    ));
  }, []);

  const removeField = useCallback((blockId: string, fieldId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, fields: b.fields.filter(f => f.id !== fieldId) } : b
    ));
  }, []);

  const getDefinition = useCallback((): TemplateDefinition => ({
    blocks: blocks.map((b, i) => ({ ...b, order: i })),
  }), [blocks]);

  return {
    blocks,
    selectedBlockId,
    selectedBlock,
    setSelectedBlockId,
    addBlock,
    removeBlock,
    reorderBlocks,
    updateBlockStyles,
    addField,
    updateField,
    removeField,
    getDefinition,
  };
}
```

### Block Canvas (Drag and Drop)

```tsx
// components/template-editor/BlockCanvas.tsx
'use client';

import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TemplateBlock } from '@/lib/types';
import { SortableBlock } from './SortableBlock';

interface Props {
  blocks: TemplateBlock[];
  selectedBlockId: string | null;
  onReorder: (activeId: string, overId: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function BlockCanvas({ blocks, selectedBlockId, onReorder, onSelect, onRemove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-64 p-4 bg-default-50 rounded-xl border-2 border-dashed border-default-200">
          {blocks.length === 0 && (
            <div className="flex items-center justify-center h-48 text-default-400 text-sm">
              Add blocks from the palette to build your template
            </div>
          )}
          {blocks.map(block => (
            <SortableBlock
              key={block.id}
              block={block}
              isSelected={block.id === selectedBlockId}
              onSelect={() => onSelect(block.id)}
              onRemove={() => onRemove(block.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

### Sortable Block

```tsx
// components/template-editor/SortableBlock.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Chip } from '@heroui/react';
import { TemplateBlock } from '@/lib/types';

interface Props {
  block: TemplateBlock;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

const BLOCK_LABELS: Record<string, string> = {
  'hero': 'Hero',
  'text-body': 'Text Body',
  'image-grid': 'Image Grid',
  'video-embed': 'Video Embed',
  'two-column': 'Two Column',
  'callout': 'Callout',
};

export function SortableBlock({ block, isSelected, onSelect, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={onSelect}
      className={`
        relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
        ${isSelected
          ? 'border-primary bg-primary-50'
          : 'border-default-200 bg-content1 hover:border-default-400'}
      `}
    >
      {/* Drag handle — stopPropagation prevents triggering onSelect when grabbing */}
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="text-default-400 hover:text-default-600 cursor-grab active:cursor-grabbing select-none px-1"
        aria-label="Drag to reorder"
      >
        ⠿
      </div>

      <div className="flex-1 min-w-0">
        <Chip size="sm" variant="flat" color={isSelected ? 'primary' : 'default'}>
          {BLOCK_LABELS[block.type] ?? block.type}
        </Chip>
        <p className="text-xs text-default-400 mt-1 truncate">
          {block.fields.length} field{block.fields.length !== 1 ? 's' : ''}
          {block.fields.some(f => f.required) && ' · has required fields'}
        </p>
      </div>

      <Button
        size="sm"
        variant="light"
        color="danger"
        isIconOnly
        onPress={(e) => { e.stopPropagation?.(); onRemove(); }}
        aria-label="Remove block"
      >
        ✕
      </Button>
    </div>
  );
}
```

---

## Rich Text Editor

```tsx
// components/rich-text/RichTextEditor.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { EditorToolbar } from './EditorToolbar';

interface Props {
  value: string;        // Tiptap JSON document serialized as string
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing...' }),
    ],
    editable: !disabled,
    content: (() => {
      try { return value ? JSON.parse(value) : ''; }
      catch { return ''; }
    })(),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Sync external value changes without causing infinite re-renders
  useEffect(() => {
    if (!editor || !value) return;
    try {
      const incoming = JSON.parse(value);
      const current = JSON.stringify(editor.getJSON());
      if (JSON.stringify(incoming) !== current) {
        editor.commands.setContent(incoming, false);
      }
    } catch { /* invalid JSON — leave editor as-is */ }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border border-default-200 rounded-xl overflow-hidden">
      {!disabled && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose max-w-none p-4 min-h-32 focus-within:outline-none"
      />
    </div>
  );
}
```

---

## Image Upload Hook

```typescript
// hooks/useImageUpload.ts
'use client';

import { useState } from 'react';

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<string> => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}` },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(data.message ?? 'Upload failed');
      }

      const { url } = await response.json();
      return url as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, error };
}
```

## Image Upload API Route (Next.js)

This route is the proxy between the admin UI and SeaweedFS. The .NET backend is not involved in uploads.

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SEAWEED_FILER_URL = process.env.SEAWEED_FILER_URL!;
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_BASE_URL!;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY!;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${ADMIN_API_KEY}`) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ code: 'VALIDATION_FAILED', message: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ code: 'VALIDATION_FAILED', message: `File type '${file.type}' is not allowed` }, { status: 422 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ code: 'VALIDATION_FAILED', message: 'File exceeds 10MB limit' }, { status: 422 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const now = new Date();
  const path = `/posts/images/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${filename}`;

  const uploadForm = new FormData();
  uploadForm.append('file', file, filename);

  const seaweedResponse = await fetch(`${SEAWEED_FILER_URL}${path}`, {
    method: 'POST',
    body: uploadForm,
  });

  if (!seaweedResponse.ok) {
    console.error('SeaweedFS upload failed:', await seaweedResponse.text());
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: 'Storage upload failed' }, { status: 502 });
  }

  return NextResponse.json({ url: `${MEDIA_BASE_URL}${path}` });
}
```

---

## Post Content Editor Page

The post edit page fetches the post (with its template definition) and renders the correct field input for each field type.

```tsx
// app/admin/posts/[id]/edit/page.tsx
import { api } from '@/lib/api';
import { PostContentEditor } from '@/components/post-editor/PostContentEditor';

export default async function EditPostPage({ params }: { params: { id: string } }) {
  // Server Component: fetch on the server, pass down to client editor
  const post = await api.posts.get(params.id);
  const template = await api.templates.get(post.templateId);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Edit Post</h1>
      <PostContentEditor post={post} template={template} />
    </div>
  );
}
```

```tsx
// components/post-editor/PostContentEditor.tsx
'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { Post, Template, TemplateBlock } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { TextField } from './fields/TextField';
import { RichTextField } from './fields/RichTextField';
import { ImageField } from './fields/ImageField';
import { VideoUrlField } from './fields/VideoUrlField';

interface Props {
  post: Post;
  template: Template;
}

export function PostContentEditor({ post, template }: Props) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState<Record<string, string>>(post.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishErrors, setPublishErrors] = useState<Record<string, string[]>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const sortedBlocks = [...template.definition.blocks].sort((a, b) => a.order - b.order);

  const setFieldValue = (fieldId: string, value: string) => {
    setContent(prev => ({ ...prev, [fieldId]: value }));
    setPublishErrors(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.posts.updateContent(post.id, { title, content });
      setSaveMessage('Draft saved.');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    // Save first, then publish
    setIsPublishing(true);
    try {
      await api.posts.updateContent(post.id, { title, content });
      await api.posts.publish(post.id);
      window.location.href = `/admin/posts`;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setPublishErrors(err.errors ?? {});
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Post title */}
      <TextField
        label="Post Title"
        value={title}
        onChange={setTitle}
        required
      />

      {/* Blocks */}
      {sortedBlocks.map(block => (
        <BlockFieldGroup
          key={block.id}
          block={block}
          content={content}
          errors={publishErrors}
          onFieldChange={setFieldValue}
        />
      ))}

      {/* Action bar */}
      <div className="flex items-center gap-3 pt-4 border-t border-default-200">
        {saveMessage && <span className="text-sm text-success">{saveMessage}</span>}
        <div className="flex-1" />
        <Button variant="flat" onPress={handleSave} isLoading={isSaving}>
          Save Draft
        </Button>
        <Button color="primary" onPress={handlePublish} isLoading={isPublishing}>
          {post.published ? 'Re-save & Update' : 'Publish'}
        </Button>
      </div>
    </div>
  );
}

function BlockFieldGroup({
  block, content, errors, onFieldChange
}: {
  block: TemplateBlock;
  content: Record<string, string>;
  errors: Record<string, string[]>;
  onFieldChange: (fieldId: string, value: string) => void;
}) {
  return (
    <section className="space-y-4 p-4 border border-default-200 rounded-xl">
      <h3 className="text-sm font-medium text-default-500 uppercase tracking-wide">
        {block.type.replace('-', ' ')}
      </h3>
      {block.fields.map(field => {
        const value = content[field.id] ?? '';
        const fieldErrors = errors[field.id];

        const commonProps = {
          label: field.label,
          value,
          onChange: (v: string) => onFieldChange(field.id, v),
          required: field.required,
          placeholder: field.placeholder,
          error: fieldErrors?.[0],
        };

        switch (field.type) {
          case 'text':       return <TextField key={field.id} {...commonProps} maxLength={field.maxLength} />;
          case 'rich-text':  return <RichTextField key={field.id} {...commonProps} />;
          case 'image':      return <ImageField key={field.id} {...commonProps} aspectRatio={field.aspectRatio} />;
          case 'video-url':  return <VideoUrlField key={field.id} {...commonProps} />;
          default:           return null;
        }
      })}
    </section>
  );
}
```

---

## Preview Route

Renders the post against the **live** template definition. Admin-gated.

```tsx
// app/preview/[id]/page.tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { PostRenderer } from '@/components/post-renderer/PostRenderer';

export default async function PreviewPage({ params }: { params: { id: string } }) {
  // Auth gate — same check as admin layout
  const cookieStore = cookies();
  if (cookieStore.get('admin_session')?.value !== process.env.ADMIN_SESSION_TOKEN) {
    redirect('/login');
  }

  const post = await api.posts.get(params.id);
  const template = await api.templates.get(post.templateId);

  return (
    <div>
      <div className="bg-warning-50 border-b border-warning-200 px-4 py-2 text-sm text-warning-700">
        Preview — this post is not published. Rendering against the current live template.
      </div>
      {/* PostRenderer is defined in the Public UI spec */}
      <PostRenderer template={template.definition} content={post.content} />
    </div>
  );
}
```

---

## What the Agent Must NOT Do

- Do not put `'use client'` on page.tsx files that only fetch data and pass to client components — keep the data-fetching layer as Server Components
- Do not call `fetch` directly inside components — use `lib/api.ts`
- Do not regenerate field `id` values when updating a template — existing field IDs must be preserved
- Do not use `<form>` HTML elements — use button `onPress` handlers with HeroUI `Button`
- Do not store the admin API key in client-side code without the `NEXT_PUBLIC_` prefix convention being understood: `NEXT_PUBLIC_ADMIN_API_KEY` is intentionally exposed to the browser for MVP; this changes when real session auth is added
- Do not use `dangerouslySetInnerHTML` without first passing through `isomorphic-dompurify`
- Do not use `localStorage` or `sessionStorage` — they are not available in SSR and will throw

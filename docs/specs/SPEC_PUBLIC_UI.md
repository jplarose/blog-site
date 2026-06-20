# Spec: Public Client UI — Blog Template System

## Target Technology
- Next.js (App Router) + TypeScript
- HeroUI component library for UI primitives where appropriate
- Tailwind CSS + `@tailwindcss/typography` (`prose` classes) for rendered post content
- Server Components by default — public pages ship zero unnecessary client JavaScript
- Static Site Generation (SSG) via `generateStaticParams` for all published posts
- `@tiptap/html` for server-side rich text rendering (no client-side Tiptap bundle)
- `isomorphic-dompurify` for sanitizing all rendered HTML before output

## Confidence Notes for Agent
- All components in this spec are Server Components unless explicitly marked `'use client'`
- `generateStaticParams` runs at build time and produces static HTML for every published post
- Revalidation strategy is ISR (Incremental Static Regeneration) — use `revalidate` export or `next: { revalidate }` in fetch calls so that newly published posts appear without a full rebuild
- The public post page never reads `templates` table directly — it always renders from `posts.template_snapshot`

## Required Packages (if not already present)

```bash
npm install @tailwindcss/typography
npm install @tiptap/html @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link
npm install isomorphic-dompurify
npm install @types/dompurify --save-dev
```

Add to `tailwind.config.ts`:

```typescript
plugins: [require('@tailwindcss/typography')],
```

---

## Directory Structure

```
app/
  (public)/                    — route group; no auth; no admin chrome
    posts/
      page.tsx                 — post index / listing
      [slug]/
        page.tsx               — individual post page

components/
  post-renderer/
    PostRenderer.tsx           — top-level renderer: iterates blocks
    blocks/
      HeroBlockRenderer.tsx
      TextBodyRenderer.tsx
      ImageGridRenderer.tsx
      VideoEmbedRenderer.tsx
      TwoColumnRenderer.tsx
      CalloutRenderer.tsx
    fields/
      RichTextFieldRenderer.tsx
      ImageFieldRenderer.tsx
      VideoUrlFieldRenderer.tsx

lib/
  tiptap-renderer.ts           — server-side generateHTML (no React dependency)
  types.ts                     — shared types (same file as admin; import from there)
  api.ts                       — same api client; public endpoints use no auth header
```

---

## Data Fetching

### Public API Calls

Public pages call the .NET backend. These calls go to the **public** endpoints that require no admin auth and filter `WHERE published = true` server-side.

```typescript
// lib/api.ts additions (public-facing, no auth header)

posts: {
  // ...existing admin methods...
  getBySlug: (slug: string) =>
    apiFetch<PublicPost>(`/api/posts/by-slug/${slug}`),
  listPublished: (categorySlug?: string) => {
    const qs = categorySlug ? `?categorySlug=${categorySlug}` : '';
    return apiFetch<PublicPostSummary[]>(`/api/posts?published=true${qs}`);
  },
},
```

Define public-facing types that exclude internal fields:

```typescript
// lib/types.ts additions

// What the public post endpoint returns
// template_snapshot is renamed to templateDefinition for clarity in the client
export interface PublicPost {
  id: string;
  title: string;
  slug: string;
  content: Record<string, string>;
  templateDefinition: TemplateDefinition;  // deserialized from template_snapshot
  categorySlug: string;
  categoryName: string;
  publishedAt: string;
}

export interface PublicPostSummary {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
  categoryName: string;
  categorySlug: string;
  // Excerpt: the backend should extract the first text field value, truncated to 200 chars
  excerpt?: string;
}
```

---

## Post Listing Page

```tsx
// app/(public)/posts/page.tsx

import { api } from '@/lib/api';
import Link from 'next/link';
import { Card, CardBody } from '@heroui/react';

// ISR: revalidate every 60 seconds so newly published posts appear
export const revalidate = 60;

export default async function PostsPage() {
  const posts = await api.posts.listPublished();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Posts</h1>
      <div className="space-y-6">
        {posts.map(post => (
          <Card key={post.id} as={Link} href={`/posts/${post.slug}`} isPressable>
            <CardBody>
              <p className="text-xs text-default-400 uppercase tracking-wide mb-1">
                {post.categoryName} · {new Date(post.publishedAt).toLocaleDateString()}
              </p>
              <h2 className="text-xl font-semibold">{post.title}</h2>
              {post.excerpt && (
                <p className="text-default-500 mt-2 line-clamp-2">{post.excerpt}</p>
              )}
            </CardBody>
          </Card>
        ))}
        {posts.length === 0 && (
          <p className="text-default-400">No posts published yet.</p>
        )}
      </div>
    </main>
  );
}
```

---

## Individual Post Page

This is the most important public page. It uses `generateStaticParams` to pre-render all published posts at build time, and renders exclusively from `template_snapshot` (exposed as `templateDefinition` on the API response).

```tsx
// app/(public)/posts/[slug]/page.tsx

import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { PostRenderer } from '@/components/post-renderer/PostRenderer';
import type { Metadata } from 'next';

// ISR: revalidate allows newly published posts to appear without full rebuild
export const revalidate = 60;

// Called at build time: generates a static page for every published post
export async function generateStaticParams() {
  const posts = await api.posts.listPublished();
  return posts.map(p => ({ slug: p.slug }));
}

// Called at build time per slug, and at runtime on cache miss
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  try {
    const post = await api.posts.getBySlug(params.slug);
    return {
      title: post.title,
      openGraph: { title: post.title, publishedTime: post.publishedAt },
    };
  } catch {
    return { title: 'Post Not Found' };
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  let post;
  try {
    post = await api.posts.getBySlug(params.slug);
  } catch {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <p className="text-sm text-default-400 uppercase tracking-wide mb-2">
          {post.categoryName} · {new Date(post.publishedAt).toLocaleDateString()}
        </p>
        <h1 className="text-4xl font-bold">{post.title}</h1>
      </header>

      {/*
        PostRenderer receives:
        - template: the snapshotted definition (NOT the live template)
        - content: the field value map
        This is the only place in the public UI that renders post content.
      */}
      <PostRenderer template={post.templateDefinition} content={post.content} />
    </main>
  );
}
```

---

## PostRenderer

The renderer is a pure Server Component. It receives the template definition and content map, sorts blocks by `order`, and delegates each block to a typed sub-renderer. No client JavaScript is needed for rendering.

```tsx
// components/post-renderer/PostRenderer.tsx

import { TemplateDefinition } from '@/lib/types';
import { HeroBlockRenderer } from './blocks/HeroBlockRenderer';
import { TextBodyRenderer } from './blocks/TextBodyRenderer';
import { ImageGridRenderer } from './blocks/ImageGridRenderer';
import { VideoEmbedRenderer } from './blocks/VideoEmbedRenderer';
import { TwoColumnRenderer } from './blocks/TwoColumnRenderer';
import { CalloutRenderer } from './blocks/CalloutRenderer';
import type { TemplateBlock } from '@/lib/types';

interface Props {
  template: TemplateDefinition;
  content: Record<string, string>;
}

export function PostRenderer({ template, content }: Props) {
  const sortedBlocks = [...template.blocks].sort((a, b) => a.order - b.order);

  return (
    <article className="space-y-8">
      {sortedBlocks.map(block => (
        <BlockRouter key={block.id} block={block} content={content} />
      ))}
    </article>
  );
}

function BlockRouter({ block, content }: { block: TemplateBlock; content: Record<string, string> }) {
  // Extract this block's field values from the content map
  // Fields not present in content default to empty string — never crash on missing values
  const fieldValues = Object.fromEntries(
    block.fields.map(f => [f.id, content[f.id] ?? ''])
  );

  const props = { block, fieldValues };

  switch (block.type) {
    case 'hero':         return <HeroBlockRenderer {...props} />;
    case 'text-body':    return <TextBodyRenderer {...props} />;
    case 'image-grid':   return <ImageGridRenderer {...props} />;
    case 'video-embed':  return <VideoEmbedRenderer {...props} />;
    case 'two-column':   return <TwoColumnRenderer {...props} />;
    case 'callout':      return <CalloutRenderer {...props} />;
    default:
      // Unknown block types are silently skipped — forward compatibility
      // for templates that may have been created with a newer block type
      return null;
  }
}
```

---

## Block Renderers

Each block renderer receives its block definition (for styles) and the pre-extracted field values for that block.

### Shared Block Props Type

```typescript
// Used by all block renderers
interface BlockRendererProps {
  block: TemplateBlock;
  fieldValues: Record<string, string>;  // field.id -> value string
}
```

### Padding + Background Style Helpers

```typescript
// Used inside block renderers to apply block-level styles
const PADDING_CLASSES: Record<string, string> = {
  'none':    'py-0',
  'compact': 'py-4',
  'normal':  'py-8',
  'wide':    'py-16',
};

const BACKGROUND_CLASSES: Record<string, string> = {
  'default': '',
  'muted':   'bg-default-50',
  'accent':  'bg-primary-50',
};

function blockClasses(block: TemplateBlock): string {
  return [
    PADDING_CLASSES[block.styles.padding] ?? 'py-8',
    BACKGROUND_CLASSES[block.styles.background] ?? '',
  ].filter(Boolean).join(' ');
}
```

### HeroBlockRenderer

```tsx
// components/post-renderer/blocks/HeroBlockRenderer.tsx

import Image from 'next/image';
import { TemplateBlock } from '@/lib/types';

interface Props { block: TemplateBlock; fieldValues: Record<string, string>; }

export function HeroBlockRenderer({ block, fieldValues }: Props) {
  // Find fields by type within this block — hero block has a defined field structure
  const imageField = block.fields.find(f => f.type === 'image');
  const headlineField = block.fields.find(f => f.label.toLowerCase().includes('headline') || f.type === 'text');
  const subheadingField = block.fields.find(f => f.label.toLowerCase().includes('subheading'));

  const imageUrl = imageField ? fieldValues[imageField.id] : null;
  const headline = headlineField ? fieldValues[headlineField.id] : null;
  const subheading = subheadingField ? fieldValues[subheadingField.id] : null;

  const alignment = block.styles.alignment === 'center' ? 'text-center items-center' : 'text-left items-start';

  return (
    <section className={`flex flex-col gap-4 ${alignment}`}>
      {imageUrl && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden">
          <Image
            src={imageUrl}
            alt={headline ?? 'Hero image'}
            fill
            className="object-cover"
            priority  // hero images are above the fold — prioritize LCP
          />
        </div>
      )}
      {headline && <h2 className="text-3xl font-bold">{headline}</h2>}
      {subheading && <p className="text-lg text-default-500">{subheading}</p>}
    </section>
  );
}
```

### TextBodyRenderer

Rich text is rendered server-side using Tiptap's `generateHTML` — no client bundle required.

```tsx
// components/post-renderer/blocks/TextBodyRenderer.tsx

import { TemplateBlock } from '@/lib/types';
import { RichTextFieldRenderer } from '../fields/RichTextFieldRenderer';

interface Props { block: TemplateBlock; fieldValues: Record<string, string>; }

export function TextBodyRenderer({ block, fieldValues }: Props) {
  const bodyField = block.fields.find(f => f.type === 'rich-text');
  if (!bodyField) return null;

  return (
    <section>
      <RichTextFieldRenderer value={fieldValues[bodyField.id] ?? ''} />
    </section>
  );
}
```

### RichTextFieldRenderer

```tsx
// components/post-renderer/fields/RichTextFieldRenderer.tsx

import { renderRichText } from '@/lib/tiptap-renderer';

interface Props { value: string; }

export function RichTextFieldRenderer({ value }: Props) {
  if (!value) return null;

  // renderRichText handles empty/invalid JSON gracefully and returns sanitized HTML
  const html = renderRichText(value);
  if (!html) return null;

  return (
    <div
      className="prose prose-lg max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

### Server-Side Rich Text Renderer

```typescript
// lib/tiptap-renderer.ts
// This file runs server-side only. Do not import it in client components.

import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import DOMPurify from 'isomorphic-dompurify';

const EXTENSIONS = [StarterKit, Image, Link];

export function renderRichText(jsonString: string): string {
  if (!jsonString) return '';

  try {
    const json = JSON.parse(jsonString);
    const html = generateHTML(json, EXTENSIONS);
    // Sanitize before returning — defense in depth against XSS even from our own storage
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4',
                     'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'hr'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'class'],
    });
  } catch {
    // Malformed JSON stored in rich-text field — render nothing, log for investigation
    console.error('[renderRichText] Failed to parse Tiptap JSON:', jsonString.slice(0, 100));
    return '';
  }
}
```

### ImageGridRenderer

```tsx
// components/post-renderer/blocks/ImageGridRenderer.tsx

import Image from 'next/image';
import { TemplateBlock } from '@/lib/types';

interface Props { block: TemplateBlock; fieldValues: Record<string, string>; }

export function ImageGridRenderer({ block, fieldValues }: Props) {
  const imageFields = block.fields.filter(f => f.type === 'image');
  const columns = block.styles.columns ?? 2;

  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
  }[columns] ?? 'grid-cols-2';

  return (
    <section className={`grid ${gridClass} gap-4`}>
      {imageFields.map(field => {
        const url = fieldValues[field.id];
        if (!url) return null;
        return (
          <div key={field.id} className="relative aspect-video rounded-lg overflow-hidden">
            <Image src={url} alt={field.label} fill className="object-cover" />
          </div>
        );
      })}
    </section>
  );
}
```

### VideoEmbedRenderer

Stores a URL string (YouTube, Vimeo, etc.). Renders as an `<iframe>` — requires `'use client'` only if interactivity beyond play is needed. A static iframe embed is fine as a Server Component.

```tsx
// components/post-renderer/blocks/VideoEmbedRenderer.tsx

import { TemplateBlock } from '@/lib/types';

interface Props { block: TemplateBlock; fieldValues: Record<string, string>; }

function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // YouTube
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
    }
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${parsed.pathname}`;
    }

    // Vimeo
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    return null; // unsupported provider
  } catch {
    return null;
  }
}

export function VideoEmbedRenderer({ block, fieldValues }: Props) {
  const urlField = block.fields.find(f => f.type === 'video-url');
  const captionField = block.fields.find(f => f.type === 'text');

  if (!urlField) return null;
  const rawUrl = fieldValues[urlField.id];
  const embedUrl = rawUrl ? toEmbedUrl(rawUrl) : null;
  const caption = captionField ? fieldValues[captionField.id] : null;

  if (!embedUrl) return null;

  return (
    <figure>
      <div className="relative w-full aspect-video rounded-xl overflow-hidden">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          title={caption ?? 'Embedded video'}
          // Content Security Policy: ensure your NGINX config allows frame-src for youtube.com and vimeo.com
        />
      </div>
      {caption && (
        <figcaption className="text-sm text-default-400 text-center mt-2">{caption}</figcaption>
      )}
    </figure>
  );
}
```

### TwoColumnRenderer

```tsx
// components/post-renderer/blocks/TwoColumnRenderer.tsx

import { TemplateBlock } from '@/lib/types';
import { RichTextFieldRenderer } from '../fields/RichTextFieldRenderer';

interface Props { block: TemplateBlock; fieldValues: Record<string, string>; }

export function TwoColumnRenderer({ block, fieldValues }: Props) {
  const [leftField, rightField] = block.fields;

  return (
    // Two-column on desktop, single column on mobile
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        {leftField && <RichTextFieldRenderer value={fieldValues[leftField.id] ?? ''} />}
      </div>
      <div>
        {rightField && <RichTextFieldRenderer value={fieldValues[rightField.id] ?? ''} />}
      </div>
    </section>
  );
}
```

Note: The `react-resizable-panels` drag handle is an **editor-only** concern. The public renderer for two-column blocks uses a fixed CSS grid — there is no runtime column resizing on the public page. The column proportions on the public page are always 50/50.

### CalloutRenderer

```tsx
// components/post-renderer/blocks/CalloutRenderer.tsx

import { TemplateBlock } from '@/lib/types';

interface Props { block: TemplateBlock; fieldValues: Record<string, string>; }

const BACKGROUND_STYLES: Record<string, string> = {
  'default': 'bg-default-100 border-default-300',
  'muted':   'bg-default-50 border-default-200',
  'accent':  'bg-primary-50 border-primary-200',
};

export function CalloutRenderer({ block, fieldValues }: Props) {
  const textField = block.fields.find(f => f.type === 'text');
  if (!textField) return null;

  const text = fieldValues[textField.id];
  if (!text) return null;

  const bgClass = BACKGROUND_STYLES[block.styles.background] ?? BACKGROUND_STYLES['default'];

  return (
    <aside className={`border-l-4 rounded-r-xl px-6 py-4 ${bgClass}`}>
      <p className="text-base font-medium">{text}</p>
    </aside>
  );
}
```

---

## NGINX Configuration Notes

Add these headers to your NGINX server block to support video embeds and image serving:

```nginx
# Allow YouTube and Vimeo in iframes
add_header Content-Security-Policy "frame-src 'self' https://www.youtube.com https://player.vimeo.com";

# Media proxy to SeaweedFS (images)
location /media/ {
    proxy_pass http://127.0.0.1:8888/posts/images/;
    proxy_set_header Host $host;

    expires 1y;
    add_header Cache-Control "public, immutable";

    limit_except GET HEAD {
        deny all;
    }
}
```

---

## What the Agent Must NOT Do

- Do not import `@tiptap/react` or any Tiptap React components in public page or renderer files — use only `@tiptap/html` for server-side rendering
- Do not add `'use client'` to block renderer components — they are Server Components and must remain so
- Do not render `template_snapshot` as anything other than `TemplateDefinition` — it must be deserialized before being passed to `PostRenderer`
- Do not render raw user-supplied HTML without passing through `renderRichText` (which includes DOMPurify sanitization)
- Do not fall through with an error when `fieldValues[field.id]` is `undefined` — default to empty string and render nothing for that field
- Do not include the admin API key or admin session token in any file inside `app/(public)/`
- The `generateStaticParams` function must call the public `listPublished` endpoint, not an admin endpoint
- Do not construct embed URLs via string concatenation — use the `toEmbedUrl` helper which validates via `URL` constructor

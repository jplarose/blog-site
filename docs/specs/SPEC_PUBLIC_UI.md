# Spec: Public Client UI — Fixed Template Catalog

## Target Technology
- Next.js (App Router) + TypeScript
- HeroUI component library for UI primitives where appropriate
- Tailwind CSS
- Server Components by default — public pages ship zero unnecessary client JavaScript
- Static Site Generation (SSG) via `generateStaticParams` for published posts, with ISR revalidation

## Confidence Notes for Agent
- All components in this spec are Server Components unless explicitly marked `'use client'`
- `generateStaticParams` runs at build time and produces static HTML for every published post
- Revalidation strategy is ISR — use `revalidate` export or `next: { revalidate }` in fetch calls so newly published posts appear without a full rebuild
- The public post page renders by fetching the post's **currently selected** catalog template (via `templateId`/`templateKey`) and its **current** `content` — there is no publish-time template snapshot to read; the fixed catalog never changes underneath a published post
- Exact response shapes and the public-facing endpoint contracts are tracked in GitHub issues **#39–#41** and are not fully fixed yet. Where this spec would need to invent a contract those issues haven't settled, it stays high-level and defers to the issue rather than prescribing one
- The renderer described below already exists in `ui-site/lib/api.ts` (`renderTemplate`) — this spec documents its contract rather than introducing a new one

---

## Directory Structure

```
app/
  (public)/                    — route group; no auth; no admin chrome
    posts/
      page.tsx                 — post index / listing
      [slug]/
        page.tsx               — individual post page

lib/
  api.ts                        — API client; renderTemplate placeholder-substitution renderer
  types.ts                      — shared types
```

There is no `components/post-renderer/` block-renderer tree, no per-block-type renderer components, and no field-type renderer components — those belonged to the retired block/field template system. Rendering a post is placeholder substitution into one HTML/CSS template, not iterating a block list.

---

## Data Fetching

Public pages call the .NET backend's public endpoints, which require no admin auth and filter to `Published` posts only.

```typescript
// lib/types.ts

export interface PublicPost {
  id: number;
  title: string;
  slug: string;
  content: string;           // sanitized rich HTML, already safe to inject
  excerpt?: string;
  featuredImageUrl?: string;
  publishedAt: string;
  categoryName?: string;
  tags: string[];
  templateId?: number;
}

export interface LayoutTemplate {
  id: number;
  templateKey: string;
  name: string;
  htmlStructure: string;
  cssStyles: string;
}
```

```typescript
// lib/api.ts (public-facing calls, no auth header)

export const templatesApi = {
  get: (id: number) => apiFetch<LayoutTemplate>(`/api/layouttemplates/${id}`),
};

export const postsApi = {
  getBySlug: (slug: string) => apiFetch<Post>(`/api/posts/slug/${slug}`),
  listPublished: (categorySlug?: string) =>
    apiFetch<PublicPost[]>(`/api/posts?status=Published${categorySlug ? `&categorySlug=${categorySlug}` : ''}`),
};
```

Final query params, pagination, and category-filter shape: issue #39.

---

## Post Listing Page

```tsx
// app/(public)/posts/page.tsx

import { postsApi } from '@/lib/api';
import Link from 'next/link';
import { Card, CardBody } from '@heroui/react';

// ISR: revalidate every 60 seconds so newly published posts appear
export const revalidate = 60;

export default async function PostsPage() {
  const posts = await postsApi.listPublished();

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

The most important public page. It uses `generateStaticParams` to pre-render all published posts at build time, fetches the post's currently-selected catalog template, and renders by placeholder substitution.

```tsx
// app/(public)/posts/[slug]/page.tsx

import { notFound } from 'next/navigation';
import { postsApi, templatesApi } from '@/lib/api';
import { renderTemplate } from '@/lib/api';
import type { Metadata } from 'next';

export const revalidate = 60;

export async function generateStaticParams() {
  const posts = await postsApi.listPublished();
  return posts.map(p => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  try {
    const post = await postsApi.getBySlug(params.slug);
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
    post = await postsApi.getBySlug(params.slug);
  } catch {
    notFound();
  }

  const template = post.templateId ? await templatesApi.get(post.templateId) : null;
  if (!template) notFound();

  // renderTemplate substitutes {{title}}, {{content}}, {{excerpt}}, {{featuredImage}},
  // {{publishedAt}}, {{category}}, {{tags}} into template.htmlStructure, honoring the
  // {{#featuredImage}}...{{/featuredImage}} conditional section. content is already
  // sanitized server-side by the API — it is injected verbatim, not re-escaped.
  const html = renderTemplate(template.htmlStructure, post, post.publishedAt);

  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: template.cssStyles }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
```

---

## Placeholder-Substitution Renderer

The renderer is pure string substitution against the selected catalog template's `htmlStructure` — there is no block tree to walk, no field-type dispatch, and no client JavaScript involved. It already exists in `ui-site/lib/api.ts` (`renderTemplate`); this section documents its contract.

```typescript
// lib/api.ts (excerpt)

/**
 * Render a template by replacing {{variable}} placeholders with post data.
 */
export function renderTemplate(
  htmlStructure: string,
  post: Post,
  publishedAt?: string
): string {
  return htmlStructure
    .replace(/\{\{title\}\}/g, escapeHtml(post.title))
    .replace(/\{\{content\}\}/g, post.content) // content is already HTML / markdown
    .replace(/\{\{excerpt\}\}/g, escapeHtml(post.excerpt ?? ""))
    .replace(/\{\{publishedAt\}\}/g, publishedAt ? new Date(publishedAt).toLocaleDateString() : "")
    .replace(/\{\{category\}\}/g, escapeHtml(post.categoryName ?? ""))
    .replace(/\{\{tags\}\}/g, post.tags.map(escapeHtml).join(", "))
    .replace(/\{\{featuredImage\}\}/g, post.featuredImageUrl ?? "")
    .replace(/\{\{#featuredImage\}\}[\s\S]*?\{\{\/featuredImage\}\}/g, (match) =>
      post.featuredImageUrl
        ? match.replace(/\{\{#featuredImage\}\}/, "").replace(/\{\{\/featuredImage\}\}/, "")
        : ""
    );
}
```

- `post.content` is trusted at this point: the .NET backend sanitizes it on write (see Backend spec). The public UI does not re-sanitize it, but it also must never accept or render any HTML that bypassed that write-time sanitization (e.g. never inject raw query params or client state through this path).
- Every catalog template's `htmlStructure` renders all seven placeholders in the standard contract (`SPEC_DB.md`); the renderer does not need per-template branching logic beyond the `{{#featuredImage}}` conditional.
- Exact excerpt/tag formatting and any additional placeholders: issue #40.

---

## NGINX / Media Notes

```nginx
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

- Do not build a block-renderer component tree (`HeroBlockRenderer`, `TextBodyRenderer`, etc.) or field-type renderer components — rendering is placeholder substitution into a single catalog template, not block iteration
- Do not read or reference a publish-time template snapshot column or type anywhere — it does not exist; the public page always renders the post's *current* content against its *currently selected* catalog template
- Do not add `'use client'` to the post page or renderer — they must remain Server Components
- Do not re-sanitize or strip `post.content` in the public UI on the assumption it might be unsafe — the trust boundary is the .NET API's write-time sanitization (Backend spec); the public UI's job is to trust that boundary, not duplicate it, and never to introduce a second path that bypasses it
- Do not include any admin session token, cookie, or header in any file inside `app/(public)/`
- The `generateStaticParams` function must call the public `listPublished` endpoint, not an admin endpoint
- Do not invent finalized response shapes, pagination, or additional placeholders beyond the standard seven-placeholder contract — reference the relevant issue (#39–#41) instead

# Template Editor API Contracts

This document tracks the .NET API work required to support the block-based template editor in `ui-admin`.

## Scope

- Multiple saved layout templates
- Category-level default template assignment
- Post-level template selection and per-template content values
- Deterministic rendering from saved layout JSON

## Shared UI Model

UI source of truth:
- [template-schema.ts](/home/jlarose/Dev/Blog-site/ui-admin/lib/template-schema.ts)

Key structures:
- `TemplateSummary`
- `LayoutTemplate`
- `TemplateLayout`
- `PostTemplateContent`

## Recommended Endpoint Shape

Primary category: `B) API boundary (Route Handlers / BFF)`

Recommended integration approach:
- `ui-admin` should call Next.js Route Handlers under `app/api/**`
- Route Handlers should forward requests to the .NET API
- Auth should terminate at the Next.js boundary so browser code does not need direct .NET credentials

Next.js doc used:
- Page title: `Route Handlers`
- Section used: `Route Handlers` and `Caching`
- File: [15-route-handlers.mdx](/home/jlarose/Dev/Blog-site/ui-admin/.next-docs/01-app/01-getting-started/15-route-handlers.mdx)

Relevant constraints:
- Route Handlers live in `app`
- They can handle the full request/response surface
- `GET` handlers are not cached by default

Implications:
- Authentication propagation can be handled server-side in the BFF
- Template reads should stay uncached or use explicit revalidation rules later
- Browser-to-.NET CORS complexity is avoided

## Controllers and Endpoints

### LayoutTemplatesController

#### `GET /api/layouttemplates`

Purpose:
- List saved templates for the templates index and post editor template picker

Response DTO:

```ts
type LayoutTemplateListItemDto = {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  categoryCount?: number;
  postCount?: number;
  createdAt: string;
  updatedAt: string;
};
```

Consumers:
- `ui-admin/app/(admin)/templates/page.tsx`
- `ui-admin/app/(admin)/posts/new/page.tsx`
- `ui-admin/app/(admin)/posts/[id]/page.tsx`

#### `GET /api/layouttemplates/{id}`

Purpose:
- Load a single template for editing or previewing

Response DTO:

```ts
type LayoutTemplateDto = {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  layout: TemplateLayoutDto;
};
```

Consumers:
- `ui-admin/app/(admin)/templates/[id]/page.tsx`

#### `POST /api/layouttemplates`

Purpose:
- Create a new saved template

Request DTO:

```ts
type CreateLayoutTemplateDto = {
  name: string;
  description?: string;
  isDefault?: boolean;
  layout: TemplateLayoutDto;
};
```

Response DTO:
- `LayoutTemplateDto`

Consumers:
- `ui-admin/app/(admin)/templates/new/page.tsx`

#### `PUT /api/layouttemplates/{id}`

Purpose:
- Update an existing template

Request DTO:

```ts
type UpdateLayoutTemplateDto = {
  name: string;
  description?: string;
  isDefault?: boolean;
  layout: TemplateLayoutDto;
};
```

Response DTO:
- `LayoutTemplateDto`

Consumers:
- `ui-admin/app/(admin)/templates/[id]/page.tsx`

#### `DELETE /api/layouttemplates/{id}`

Purpose:
- Remove a template that is no longer used

Open backend question:
- Should delete be blocked when the template is referenced by categories or posts?

Consumers:
- `ui-admin/app/(admin)/templates/page.tsx`

### CategoriesController

#### `GET /api/categories`

Required contract adjustment:
- Ensure category list payload includes `defaultTemplateId` and `defaultTemplateName`

Consumers:
- `ui-admin/app/(admin)/categories/page.tsx`
- `ui-admin/app/(admin)/posts/new/page.tsx`
- `ui-admin/app/(admin)/posts/[id]/page.tsx`

#### `PUT /api/categories/{id}`

Required request support:
- Allow updating `defaultTemplateId`

Suggested request shape:

```ts
type UpdateCategoryDto = {
  name: string;
  slug: string;
  description?: string;
  defaultTemplateId?: number | null;
};
```

Consumers:
- `ui-admin/app/(admin)/categories/page.tsx`

### PostsController

#### `GET /api/posts/{id}`

Required contract adjustment:
- Include `templateContent`

Suggested response addition:

```ts
type PostTemplateContentDto = {
  templateId: number;
  values: Record<string, string | TemplateImageValueDto | TemplateGalleryItemValueDto[]>;
};
```

Consumers:
- `ui-admin/app/(admin)/posts/[id]/page.tsx`

#### `POST /api/posts`

Required request support:
- Allow explicit `templateId`
- Allow per-post content values bound to template slots

Suggested request shape:

```ts
type CreatePostDto = {
  title: string;
  slug: string;
  excerpt?: string;
  status: "Draft" | "Scheduled" | "Published" | "Archived";
  categoryId?: number;
  templateId?: number;
  templateContent?: PostTemplateContentDto;
  tags: string[];
  featuredImageUrl?: string;
  scheduledAt?: string;
};
```

Consumers:
- `ui-admin/app/(admin)/posts/new/page.tsx`

#### `PUT /api/posts/{id}`

Required request support:
- Same template-related fields as create

Consumers:
- `ui-admin/app/(admin)/posts/[id]/page.tsx`

## DTO Reference

These DTOs should mirror the UI schema in a backend-safe shape.

```ts
type TemplateLayoutDto = {
  version: 1;
  canvas: {
    width: number;
    minRowHeight: number;
    backgroundColor?: string;
  };
  rootBlockIds: string[];
  blocks: Record<string, TemplateBlockDto>;
};

type TemplateBlockDto =
  | TitleTemplateBlockDto
  | RichTextTemplateBlockDto
  | ImageTemplateBlockDto
  | GalleryTemplateBlockDto
  | ColumnTemplateBlockDto
  | ContainerTemplateBlockDto;
```

Notes:
- Backend should persist the layout payload as JSON without lossy transformation
- Block `id` values must remain stable once saved so per-post content bindings remain valid
- Unknown block kinds should be rejected server-side

## Open Questions

1. Should a template be mutable after posts already reference it, or should we version templates?
2. If a template changes, should existing posts keep their stored `templateContent` only, or also pin the layout snapshot used at publish time?
3. Should categories inherit the latest template automatically, or only the template ID reference?
4. What validation rules does the backend enforce for nested blocks and required content bindings?

## Phase 1 UI Stubs

Completed in `ui-admin`:
- Shared template schema file
- API client types aligned to schema direction
- Contract tracker document

Next implementation step:
- Add `app/api/**` Route Handler stubs in `ui-admin` that proxy the template/category/post endpoints

# Spec: Database — Fixed Template Catalog

## Target Technology
- PostgreSQL 15+ (primary datastore)
- Changes are delivered as sequential, numbered migration files (`sql/migrations/NNN_description.sql`)
- `SERIAL` primary keys (not UUIDs); `gen_random_uuid()`/`pgcrypto` is enabled for future use but no table currently uses a UUID key
- All timestamps are `TIMESTAMPTZ`, defaulting to `NOW()`

## Migration Policy
Migrations are sequential, numbered, and applied in order — `001`, `002`, `003`, etc. The default expectation is that migrations are additive (`IF NOT EXISTS` guards, no destructive `DROP`/column removal), so that a running database can always move forward without a backup/restore step.

`003_fixed_template_catalog_reset.sql` is a **sanctioned, deliberate exception** to that rule: it is a destructive, development-only reset that retires the old user-editable template system in favor of the fixed catalog. It is documented and guarded as such (see below); it is not a pattern to repeat for ordinary schema changes. Any future migration that needs to remove or reshape data destructively should follow the same explicit pattern: a clear `DESTRUCTIVE — DEVELOPMENT ONLY` header, a description of exactly what is deleted, and an explicit statement that there is no in-place rollback.

---

## Current Schema (migrations 001 → 003)

### `layout_templates`

The fixed, application-managed template catalog. Rows are seeded (`sql/seeds/002_catalog_templates.sql`), not created by end users — there is no template CRUD.

```sql
CREATE TABLE layout_templates (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    html_structure  TEXT NOT NULL DEFAULT '',
    css_styles      TEXT NOT NULL DEFAULT '',
    template_key    VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uix_layout_templates_template_key ON layout_templates (template_key);
```

- `template_key` is the stable, human-readable identifier posts and the API reference (`article`, `feature`, `photo-essay`). It is unique and never reused across different templates.
- `html_structure` / `css_styles` hold trusted, application-authored HTML and CSS markup — not user input. See "Catalog template contract" below.
- There is no `is_default` column and no concept of a default template. Posts always explicitly select a template; the catalog itself has no default.
- There is no JSON canvas/block-definition column on this table. The catalog does not use a block-based layout model.

### `categories`

```sql
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    slug        VARCHAR(200) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uix_categories_slug ON categories (slug);
```

- Categories do **not** assign a default template. Template selection is a per-post decision only.

### `posts`

```sql
CREATE TABLE posts (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(500) NOT NULL,
    slug                VARCHAR(500) NOT NULL,
    content             TEXT NOT NULL DEFAULT '',
    excerpt             TEXT,
    featured_image_url  TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'Draft'
                            CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived')),
    published_at        TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    category_id         INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    template_id         INTEGER REFERENCES layout_templates (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uix_posts_slug ON posts (slug);
CREATE INDEX ix_posts_status ON posts (status);
CREATE INDEX ix_posts_published_at ON posts (published_at DESC);
CREATE INDEX ix_posts_category_id ON posts (category_id);
```

- `content` is sanitized, rich **HTML** (`TEXT`), produced by the admin post editor and sanitized server-side before storage/render — not a JSONB block-content map.
- `template_id` is the post's explicit selection of one `layout_templates` row (by id — the API/UI work in terms of `template_key` at the presentation layer, see Backend/Admin/Public specs). There is no per-post template-content map column: a post does not carry a per-post map of template field values, and there is no template snapshot taken at publish time. The renderer always injects the post's live `content` (and other post fields) into the currently-selected catalog template at render time.
- `status` drives the workflow `Draft → Scheduled → Published → Archived`.

### `tags` / `post_tags`

```sql
CREATE TABLE tags (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    slug       VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uix_tags_slug ON tags (slug);

CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags  (id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
```

### `page_views`

Analytics table backing the admin dashboard.

```sql
CREATE TABLE page_views (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER REFERENCES posts (id) ON DELETE SET NULL,
    path       VARCHAR(1000) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer   TEXT,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_page_views_viewed_at ON page_views (viewed_at DESC);
CREATE INDEX ix_page_views_post_id   ON page_views (post_id);
```

---

## Migration History

- **Migration 001** (`sql/migrations/001_initial_schema.sql`) — creates all six tables above in their *original* shape: `layout_templates` had `is_default BOOLEAN` (with a partial unique index enforcing at most one default) instead of `template_key`; `categories` had `default_template_id` (FK to `layout_templates`); `posts` had no per-post template-content column yet.
- **Migration 002** — added a JSON canvas/block layout column to `layout_templates` and a per-post template-content JSONB column to `posts`, in support of the (now retired) user-editable, block-based template system.
- **Migration 003** (`sql/migrations/003_fixed_template_catalog_reset.sql`) — the destructive, development-only reset (issue #24) that removes the editable-template system and reshapes `layout_templates` into the fixed catalog described above. See next section.

## Migration 003 — Destructive Development Reset

`003_fixed_template_catalog_reset.sql` is guarded with an explicit `DESTRUCTIVE — DEVELOPMENT ONLY` header and is intended only for disposable development databases (there is no in-place rollback — restore from a backup, or recreate the dev database from scratch).

What it does, in order:

1. **Deletes all rows** from `page_views`, `post_tags`, `posts`, and `layout_templates` (children before parents). `categories` and `tags` rows are retained.
2. Drops `categories.default_template_id` — categories no longer carry a template default.
3. Drops the per-post template-content JSONB column from `posts` — posts no longer carry a per-post template field-value map.
4. Reshapes `layout_templates`: drops the `uix_layout_templates_default` partial index and the `is_default` column (the catalog has no default — posts always explicitly select a template), drops the JSON canvas/block layout column (no block/canvas layout model), adds `template_key VARCHAR(100) NOT NULL` with a new unique index `uix_layout_templates_template_key`. `html_structure` and `css_styles` are retained — the fixed catalog stores its trusted HTML/CSS markup in these same columns.

Migration 003 intentionally leaves `layout_templates` empty; the three catalog rows are populated by a later seed script (`seeds/002_catalog_templates.sql`, issue #25), not by the migration itself.

Two supported application paths (mirrors `sql/README.md`):

- **Clean schema** — create a fresh database and run `001` → `002` → `003`, then `seeds/001_seed_data.sql` → `seeds/002_catalog_templates.sql`.
- **Migrated schema** — against an existing dev database that already has `001` and `002` applied, run `003` directly to reset it to the fixed-catalog shape, then run `seeds/002_catalog_templates.sql` to (re)populate the catalog.

---

## Seeded Catalog (`seeds/002_catalog_templates.sql`)

Seeds exactly three rows into `layout_templates`, keyed by `template_key`: **`article`**, **`feature`**, **`photo-essay`**. The script is idempotent — it upserts on `template_key` via `ON CONFLICT (template_key) DO UPDATE`, so reseeding (e.g. on deploy) converges catalog content to whatever is defined in the script. These templates are application-managed only: nothing in the product creates, edits, or deletes catalog entries.

### Catalog template placeholder contract

Every template's `html_structure` renders the same standard, mustache-style variable contract:

| Placeholder | Meaning |
|---|---|
| `{{title}}` | Post title (plain text) |
| `{{content}}` | Sanitized rich post body HTML (sanitized upstream by the API; templates place it verbatim) |
| `{{excerpt}}` | Short summary (plain text) |
| `{{featuredImage}}` | Hero image URL; markup using it is wrapped in a `{{#featuredImage}}...{{/featuredImage}}` conditional section so posts without a hero render cleanly |
| `{{publishedAt}}` | Display date |
| `{{category}}` | Category name |
| `{{tags}}` | Rendered tag list |

HTML/CSS quality bar for catalog templates: semantic/accessible markup (`<article>`, heading hierarchy starting at `<h1>`, alt text using `{{title}}`); responsive, fluid layout with `max-width` content columns and `max-width:100%; height:auto` images; CSS class selectors scoped per template (`.tpl-article`, `.tpl-feature`, `.tpl-photo-essay`) so multiple templates' CSS can be present on the same page without collision; inert content only — no `<script>`, no inline event handlers, no `@import`/`url()` fetches, no external assets.

There is no per-template field/block schema, no field-level required/optional metadata, and no per-template variable set beyond the standard contract above — all three catalog templates render the same fixed set of placeholders.

---

## Relationship Summary

```
categories
    └── posts (category_id FK, ON DELETE SET NULL)

layout_templates (fixed catalog; seeded, not user-created)
    └── posts (template_id FK, ON DELETE SET NULL) — explicit per-post selection

posts
    └── post_tags ── tags
    └── page_views (post_id FK, ON DELETE SET NULL)
```

A post explicitly selects one catalog template via `template_id`; deleting a template (not expected in normal operation, since the catalog is fixed) sets `posts.template_id` to `NULL` rather than blocking or cascading.

---

## Queries the Application Will Run (Reference for Index Justification)

| Query | Index Used |
|---|---|
| Public page: `SELECT ... FROM posts WHERE slug = $1` | `uix_posts_slug` |
| Public listing: `SELECT ... FROM posts WHERE status = 'Published' ORDER BY published_at DESC` | `ix_posts_status`, `ix_posts_published_at` |
| Admin post list: `SELECT ... FROM posts WHERE category_id = $1` | `ix_posts_category_id` |
| Catalog lookup: `SELECT ... FROM layout_templates WHERE template_key = $1` | `uix_layout_templates_template_key` |
| Category lookup: `SELECT ... FROM categories WHERE slug = $1` | `uix_categories_slug` |
| Analytics dashboard: `SELECT ... FROM page_views WHERE viewed_at > $1` | `ix_page_views_viewed_at` |

---

## What the Agent Must NOT Do

- Do not reintroduce a JSON canvas/block layout column on `layout_templates`, the `layout_templates.is_default` column, a per-post template-content column on `posts`, or `categories.default_template_id` — these were deliberately removed by migration 003 and are not part of the fixed-catalog model.
- Do not add template CRUD migrations/endpoints/tables (no `blocks` table, no `fields` table, no `definition` JSONB) — the catalog is fixed at exactly three seeded rows.
- Do not store image binary data in the database — image fields store URL strings only.
- Do not add a unique constraint on `layout_templates.name` — uniqueness is enforced on `template_key`, not `name`.
- Do not treat migration 003's destructive, data-deleting pattern as the norm for future migrations — it is a sanctioned one-time exception for the development-only catalog reset; ordinary migrations must remain additive.

# Spec: Database — Blog Template System

## Target Technology
- PostgreSQL (primary datastore)
- All changes delivered as sequential, numbered migration files
- Migrations must be additive — no `DROP TABLE`, no `ALTER COLUMN` that removes or renames existing columns
- Use `gen_random_uuid()` for UUID generation (requires `pgcrypto` extension, enabled in first migration if not already present)

## Confidence Notes for Agent
- Assume `pgcrypto` extension may not be present; guard with `CREATE EXTENSION IF NOT EXISTS pgcrypto`
- Do not assume any existing schema; treat this as greenfield unless the codebase already contains migration files, in which case append new numbered migrations
- All JSONB columns store UTF-8 text; no binary blobs in the database

---

## Migration 001 — Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## Migration 002 — Core Tables

### `categories`

Organizational groupings for both templates and posts. A template belongs to one category. A post belongs to one category (which also scopes which templates are available during post creation).

```sql
CREATE TABLE categories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_slug ON categories (slug);
```

**Constraints:**
- `slug` must be URL-safe: lowercase, hyphens only, no spaces. Enforce in application layer, not DB.
- `name` must be unique in practice but enforce via unique index, not constraint, so error messages are catchable:

```sql
CREATE UNIQUE INDEX idx_categories_name_unique ON categories (lower(name));
```

---

### `templates`

Defines the block/field structure for a post type. The full layout is stored as JSONB in `definition`.

```sql
CREATE TABLE templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID        NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    name        TEXT        NOT NULL,
    description TEXT,
    definition  JSONB       NOT NULL,
    created_by  UUID,       -- nullable; FK to users table added when auth is implemented
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_category_id ON templates (category_id);
```

**`definition` JSONB shape** — the agent must understand this schema because it is the contract between the template editor, the post authoring form, and both renderers:

```jsonc
{
  "blocks": [
    {
      "id": "uuid-string",          // stable identifier for this block within the template
      "type": "hero",               // one of: hero | text-body | image-grid | video-embed | two-column | callout
      "order": 0,                   // integer; blocks are sorted ascending by this value before rendering
      "fields": [
        {
          "id": "uuid-string",      // stable identifier; used as the key in posts.content
          "type": "text",           // one of: text | rich-text | image | video-url | tag-list
          "label": "Hero Title",    // human-readable label shown in the post authoring form
          "placeholder": "...",     // optional hint text
          "required": true,
          "maxLength": 200,         // optional; applies to type=text only
          "aspectRatio": "16:9"     // optional; applies to type=image only
        }
      ],
      "styles": {
        "padding": "normal",        // one of: none | compact | normal | wide
        "background": "default",    // one of: default | muted | accent
        "columns": 2,               // optional; applies to type=image-grid and type=two-column
        "alignment": "left"         // one of: left | center | right
      }
    }
  ]
}
```

**Important:** Field `id` values within a template must be stable UUIDs. They are used as keys in `posts.content`. If a template edit changes a field `id`, all existing drafts using that template will silently lose that field's value. The application layer must enforce that field IDs are never regenerated during a template edit — only new fields get new IDs.

---

### `posts`

```sql
CREATE TABLE posts (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id       UUID        REFERENCES templates (id) ON DELETE RESTRICT,
    category_id       UUID        NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    title             TEXT        NOT NULL,
    slug              TEXT        NOT NULL UNIQUE,
    content           JSONB       NOT NULL DEFAULT '{}',
    template_snapshot JSONB,                            -- NULL on drafts; populated at publish time
    published         BOOLEAN     NOT NULL DEFAULT false,
    published_at      TIMESTAMPTZ,
    author_id         UUID,                             -- nullable; FK added when auth is implemented
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_slug        ON posts (slug);
CREATE INDEX idx_posts_category_id ON posts (category_id);
CREATE INDEX idx_posts_template_id ON posts (template_id);
CREATE INDEX idx_posts_published   ON posts (published, published_at DESC);
```

**`content` JSONB shape:**

```jsonc
{
  "<field-uuid>": "<value-string>",
  "<field-uuid>": "{\"type\":\"doc\",\"content\":[...]}"   // rich-text: Tiptap JSON serialized as string
}
```

All values are strings. Rich-text values are Tiptap JSON documents serialized to a JSON string (i.e., a string containing JSON, not nested JSON). This keeps the content map flat and avoids JSONB parsing ambiguity.

**`template_snapshot`:** Populated at publish time with a verbatim copy of `templates.definition` at that moment. Once set, never updated. The public renderer reads this column exclusively; it never joins to `templates` for published posts.

---

## Migration 003 — Updated-At Triggers

Apply to all three tables so `updated_at` is maintained by the database, not the application layer:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Migration 004 — Publish Consistency Constraint

Enforce at the database level that `template_snapshot` and `published_at` are always both set or both null together. This prevents a partial-publish state from persisting if application logic has a bug:

```sql
ALTER TABLE posts ADD CONSTRAINT chk_publish_consistency
    CHECK (
        (published = false AND template_snapshot IS NULL AND published_at IS NULL)
        OR
        (published = true AND template_snapshot IS NOT NULL AND published_at IS NOT NULL)
    );
```

---

## Relationship Summary

```
categories
    └── templates (category_id FK)
    └── posts (category_id FK)
            └── (template_id FK — soft reference after publish)
```

A category can have many templates. A category can have many posts. A post references a template (for admin grouping and draft rendering) but is not constrained to belong to the same category as its template — the application layer enforces this during post creation; the database does not, to allow template reassignment in future admin tooling without a cascading data migration.

---

## Queries the Application Will Run (Reference for Index Justification)

| Query | Index Used |
|---|---|
| Public page: `SELECT ... FROM posts WHERE slug = $1` | `idx_posts_slug` |
| SSG: `SELECT slug FROM posts WHERE published = true` | `idx_posts_published` |
| Admin post list: `SELECT ... FROM posts WHERE category_id = $1` | `idx_posts_category_id` |
| Template picker: `SELECT ... FROM templates WHERE category_id = $1` | `idx_templates_category_id` |
| Category lookup: `SELECT ... FROM categories WHERE slug = $1` | `idx_categories_slug` |

---

## What the Agent Must NOT Do

- Do not add `ON DELETE CASCADE` to `posts.template_id` or `posts.category_id`. Use `ON DELETE RESTRICT`. Deleting a category or template that has posts attached should be a hard error, not a silent cascade.
- Do not store image binary data in the database. Image fields store URL strings only.
- Do not normalize the `definition` JSONB into relational rows (no `blocks` table, no `fields` table). The JSONB is the schema.
- Do not add a unique constraint on `templates.name`. Template names are not required to be globally unique, only unique within a category — and even that is a UX concern, not a data integrity concern.

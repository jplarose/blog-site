# BlogSite SQL

This directory contains all PostgreSQL schema definitions and migration scripts for the BlogSite database.

## Directory Structure

```
sql/
├── migrations/          # Ordered DDL migrations (run in sequence)
│   ├── 001_initial_schema.sql
│   ├── 002_template_layout_json.sql
│   └── 003_fixed_template_catalog_reset.sql
└── seeds/               # Data seed scripts (run after migrations)
    ├── 001_seed_data.sql
    └── 002_catalog_templates.sql
```

## Running Migrations

### Prerequisites
- PostgreSQL 15+
- `psql` CLI or a compatible client

### Create the database

```bash
psql -U postgres -c "CREATE DATABASE blogsite;"
```

### Apply migrations

```bash
psql -U postgres -d blogsite -f migrations/001_initial_schema.sql
psql -U postgres -d blogsite -f migrations/002_template_layout_json.sql
psql -U postgres -d blogsite -f migrations/003_fixed_template_catalog_reset.sql
```

### Apply seed data (optional)

```bash
psql -U postgres -d blogsite -f seeds/001_seed_data.sql
psql -U postgres -d blogsite -f seeds/002_catalog_templates.sql
```

## Destructive reset (development only)

`migrations/003_fixed_template_catalog_reset.sql` is a **destructive,
development-only** migration that prepares the schema for the fixed,
database-seeded template catalog (issue #24). Running it **deletes all
rows** from `posts`, `post_tags`, `page_views`, and `layout_templates`,
and removes the old editable-template columns (`layout_json`,
`template_content`, `is_default`, `categories.default_template_id`).
`categories` and `tags` rows are retained. Only run it against a
disposable development database.

Two supported application paths:

- **Clean schema** — create a fresh database and run migrations in
  order, then seed: `001` → `002` → `003` → `seeds/001_seed_data.sql` →
  `seeds/002_catalog_templates.sql`.
- **Migrated schema** — against an existing dev database that already
  has `001` and `002` applied, run `003` directly to reset it to the
  fixed-catalog shape, then run `seeds/002_catalog_templates.sql` to
  (re)populate the catalog.

## Catalog templates

`seeds/002_catalog_templates.sql` seeds the fixed template catalog
(issue #25) into `layout_templates`: exactly three rows — `article`,
`feature`, `photo-essay` — keyed by the stable `template_key` column.
These templates are **application-managed and never user-edited**:
admins choose one of the three for a post, but cannot create, edit, or
delete catalog entries. The script upserts on `template_key` (via
`ON CONFLICT (template_key) DO UPDATE ...`, using the unique index
`uix_layout_templates_template_key` as the conflict target), so
reseeding is idempotent and converges catalog content to whatever is
defined in the script.

Every template's `html_structure` renders the same standard,
mustache-style variable contract:

| Placeholder | Meaning |
|---|---|
| `{{title}}` | Post title (plain text) |
| `{{content}}` | Rich post body HTML (sanitized upstream by the API) |
| `{{excerpt}}` | Short summary (plain text) |
| `{{featuredImage}}` | Hero image URL; markup using it is wrapped in `{{#featuredImage}}...{{/featuredImage}}` so posts without a hero render cleanly |
| `{{publishedAt}}` | Display date |
| `{{category}}` | Category name |
| `{{tags}}` | Rendered tag list |

See the comment header in `seeds/002_catalog_templates.sql` for the
full contract and HTML/CSS quality bar (semantic markup, responsive
layout, per-template scoped CSS class prefixes, no scripts/external
assets).

## Naming Conventions

- Migration files are prefixed with a zero-padded sequence number: `NNN_description.sql`
- Table names use `snake_case` and are plural (e.g., `posts`, `categories`)
- Column names use `snake_case`
- All timestamps are stored as `TIMESTAMPTZ` (UTC)

## Adding a New Migration

1. Create a new file: `migrations/NNN_description.sql` (increment the number)
2. Write idempotent DDL using `IF NOT EXISTS` / `IF EXISTS` guards
3. Document the change with a comment header
4. Test against a local database before committing

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
    └── 001_seed_data.sql
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
  order, then seed: `001` → `002` → `003` → `seeds/001_seed_data.sql`
  (or the catalog seed once it lands).
- **Migrated schema** — against an existing dev database that already
  has `001` and `002` applied, run `003` directly to reset it to the
  fixed-catalog shape.

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

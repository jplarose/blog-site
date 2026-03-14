# BlogSite SQL

This directory contains all PostgreSQL schema definitions and migration scripts for the BlogSite database.

## Directory Structure

```
sql/
├── migrations/          # Ordered DDL migrations (run in sequence)
│   └── 001_initial_schema.sql
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
```

### Apply seed data (optional)

```bash
psql -U postgres -d blogsite -f seeds/001_seed_data.sql
```

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

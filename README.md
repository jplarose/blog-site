# blog-site

A full-stack blog platform with a public-facing site, an admin dashboard, a .NET Web API backend, and a PostgreSQL database schema directory.

## Repository Structure

```
blog-site/
├── api/          # .NET 10 Web API (ASP.NET Core + Dapper + Npgsql/PostgreSQL)
├── sql/          # PostgreSQL schema migrations and seed data
├── ui-admin/     # Next.js 16 + TypeScript admin dashboard
└── ui-site/      # Next.js 16 + TypeScript public blog site
```

---

## `/api` — .NET 10 Web API

**Tech stack:** ASP.NET Core 10 · Dapper · Npgsql (PostgreSQL) · JWT Bearer Authentication

### Features
- CRUD endpoints for **Posts**, **Categories**, and **Tags**; a read-only **Layout Templates** catalog endpoint
- Post status workflow: `Draft → Scheduled → Published → Archived`
- Post scheduling (publish at a future date)
- Analytics: page-view recording and summary (top posts, daily views, unique visitors)
- CORS configured for both front-end origins

### Run locally

```bash
cd api
# Set your connection string (or use appsettings.json)
dotnet run
# OpenAPI docs: http://localhost:5000/openapi/v1.json
```

### SeaweedFS image storage

Configure the API's `SeaweedFiler` section:

- `PrivateBaseUrl`: internal Filer upload endpoint
- `PublicBaseUrl`: browser-accessible media origin
- `PathPrefix`: object namespace, default `images`

The admin UI uploads through the .NET API; it does not connect to SeaweedFS
directly.

---

## `/sql` — Database Schema

**Tech stack:** PostgreSQL 15+

Contains ordered migration scripts and seed data.

```bash
psql -U postgres -c "CREATE DATABASE blogsite;"
psql -U postgres -d blogsite -f sql/migrations/001_initial_schema.sql
psql -U postgres -d blogsite -f sql/seeds/001_seed_data.sql   # optional
```

See [`sql/README.md`](sql/README.md) for full documentation.

---

## `/ui-admin` — Admin Dashboard

**Tech stack:** Next.js 16 · TypeScript · Tailwind CSS · App Router

### Features
- **Login** page (connects to JWT auth endpoint)
- **Dashboard** with quick stats and actions
- **Posts** — list, filter by status, create new post with live preview
- **Post Editor** — Write/Preview tabs, draft save, scheduling, category/tag selection, and picking one of the three fixed catalog templates
- **Categories** — create, edit (no default template — template selection is per post)
- **Tags** — create and manage tags
- **Layout Templates** — fixed, seeded catalog of three templates (Article, Feature, Photo Essay); not user-editable
- **Analytics** — page view stats, top posts, daily view chart

### Run locally

```bash
cd ui-admin
cp .env.example .env.local   # set APP_BASE_URL and DOTNET_APP_BASE_URL
npm install
npm run dev                  # http://localhost:3000
```

---

## `/ui-site` — Public Blog Site

**Tech stack:** Next.js 16 · TypeScript · Tailwind CSS · App Router (SSR + ISR)

### Features
- **Home page** — lists all published posts (ISR, revalidates every 60 s)
- **Post page** (`/blog/[slug]`) — renders post using its selected catalog layout template
- **Category page** (`/category/[slug]`) — lists all published posts in a category
- **Categories listing** (`/categories`)
- Template rendering: `{{title}}`, `{{content}}`, `{{publishedAt}}`, `{{category}}`, `{{tags}}`, `{{featuredImage}}` variables

### Run locally

```bash
cd ui-site
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev                  # http://localhost:3001
```

---

## Local Development Setup

1. **Start PostgreSQL** and create the `blogsite` database
2. **Apply SQL migrations:** `psql -U postgres -d blogsite -f sql/migrations/001_initial_schema.sql`
3. **Start the API:** `cd api && dotnet run` (port 5000)
4. **Start the admin UI:** `cd ui-admin && npm run dev` (port 3000)
5. **Start the public UI:** `cd ui-site && npm run dev -- --port 3001` (port 3001)

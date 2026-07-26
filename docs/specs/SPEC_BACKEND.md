# Spec: .NET Backend API — Fixed Template Catalog

## Target Technology
- .NET Web API (ASP.NET Core, minimal API or controller-based — match whatever pattern already exists in the codebase)
- Dapper for all data access — no EF Core, no ORMs
- PostgreSQL via `Npgsql` driver
- JWT Bearer authentication issued by a shared external Auth API; the Next.js admin BFF holds the JWT in an HttpOnly cookie and forwards it to this API — see Auth Model below
- All endpoints return `application/json`
- Structured error responses on all failure paths (see Error Contract section)

## Confidence Notes for Agent
- Assume Npgsql and Dapper are already installed and DI is configured; register `IDbConnectionFactory` in the DI container
- Do not use `dynamic` for Dapper query results — always map to typed record/class
- PostgreSQL parameter syntax is `@ParamName` with Npgsql/Dapper (not `$1`)
- The detailed request/response contracts for the endpoints below (exact routes, DTOs, pagination/filtering shape, JWT validation specifics) are tracked in GitHub issues **#30–#34** and are not fully fixed yet. Where this spec would need to invent a contract those issues haven't settled, it stays high-level and defers to the issue rather than prescribing one.

---

## Project Structure Conventions

Place new files under these paths (adjust to match existing project structure if it differs):

```
/src
  /Features
    /Categories
      CategoryEndpoints.cs
      CategoryRepository.cs
      CategoryModels.cs
    /Templates
      TemplateEndpoints.cs      — read-only catalog resource, see below
      TemplateRepository.cs
      TemplateModels.cs
    /Posts
      PostEndpoints.cs
      PostRepository.cs
      PostModels.cs
    /Analytics
      AnalyticsEndpoints.cs
      AnalyticsRepository.cs
  /Infrastructure
    DbConnectionFactory.cs
    Auth.cs
  /Common
    ErrorResponse.cs
    SlugHelper.cs
    HtmlSanitizer.cs
```

---

## Infrastructure

### Database Connection Factory

```csharp
// Infrastructure/DbConnectionFactory.cs
using System.Data;
using Npgsql;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class NpgsqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public NpgsqlConnectionFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    public IDbConnection CreateConnection()
    {
        // Npgsql connections are not thread-safe; always create a new one per unit of work.
        // Npgsql maintains its own connection pool internally — opening/closing is cheap.
        return new NpgsqlConnection(_connectionString);
    }
}
```

Register in `Program.cs`:

```csharp
builder.Services.AddSingleton<IDbConnectionFactory>(
    new NpgsqlConnectionFactory(builder.Configuration.GetConnectionString("Postgres")!));
```

---

## Auth Model

BlogSite is a single-owner admin (no users/roles UI). Authentication is delegated to a **shared external Auth API**; this backend does not issue or store credentials itself. The flow, at a high level:

1. The admin signs in against the external Auth API from the Next.js admin BFF.
2. The BFF stores the resulting JWT in an **HttpOnly cookie** — never exposed to client-side JavaScript.
3. Protected admin requests from the BFF to this API carry that JWT as a Bearer token; this API validates the JWT (issuer/audience/signature) and treats a valid token as an authenticated admin session. There is no concept of multiple roles or permission levels — a valid token is the admin.
4. Public/read endpoints (published posts, the template catalog) require no token.

The exact JWT validation setup (issuer, audience, key source, refresh handling) is tracked in issue **#30** and is not fixed by this spec — implement standard ASP.NET Core JWT Bearer middleware against whatever the Auth API documents, and keep the validation logic isolated (e.g. in `Infrastructure/Auth.cs`) so it is the only place that changes if the Auth API's token shape changes.

---

### Error Response Contract

All endpoints must return this shape on errors. Do not return bare strings or unstructured objects.

```csharp
// Common/ErrorResponse.cs
public record ErrorResponse(string Code, string Message, Dictionary<string, string[]>? Errors = null);
```

Example responses:

```json
// 400
{ "code": "VALIDATION_FAILED", "message": "One or more fields are invalid.", "errors": { "title": ["Title is required."] } }

// 404
{ "code": "NOT_FOUND", "message": "Post with id 42 was not found." }

// 409
{ "code": "CONFLICT", "message": "A category with slug 'tutorials' already exists." }

// 401
{ "code": "UNAUTHORIZED", "message": "A valid admin session is required." }
```

---

### Slug Helper

Used by categories and posts. Enforce URL-safety in the application layer.

```csharp
// Common/SlugHelper.cs
using System.Text.RegularExpressions;

public static class SlugHelper
{
    public static string Generate(string input)
    {
        var slug = input.ToLowerInvariant();
        slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");
        slug = Regex.Replace(slug, @"\s+", "-");
        slug = Regex.Replace(slug, @"-+", "-");
        return slug.Trim('-');
    }

    public static bool IsValid(string slug) =>
        !string.IsNullOrWhiteSpace(slug) &&
        Regex.IsMatch(slug, @"^[a-z0-9]+(?:-[a-z0-9]+)*$");
}
```

---

## Domain Models

Models mirror the current schema (`SPEC_DB.md`) — `SERIAL` integer ids, not UUIDs.

```csharp
// Features/Categories/CategoryModels.cs
public record Category(int Id, string Name, string Slug, string? Description, DateTime CreatedAt, DateTime UpdatedAt);
public record CreateCategoryRequest(string Name, string? Description);
public record UpdateCategoryRequest(string Name, string? Description);

// Features/Templates/TemplateModels.cs
// Read-only catalog resource — no create/update/delete request types exist.
public record LayoutTemplate(int Id, string TemplateKey, string Name, string Description, string HtmlStructure, string CssStyles, DateTime CreatedAt, DateTime UpdatedAt);

// Features/Posts/PostModels.cs
public record Post(
    int Id, string Title, string Slug,
    string Content,               // sanitized rich HTML body — not a field-value map
    string? Excerpt, string? FeaturedImageUrl,
    string Status,                // Draft | Scheduled | Published | Archived
    DateTime? PublishedAt, DateTime? ScheduledAt,
    int? CategoryId, int? TemplateId,
    DateTime CreatedAt, DateTime UpdatedAt
);
public record CreatePostRequest(string Title, string? Slug, int? CategoryId, int? TemplateId);
public record UpdatePostRequest(string Title, string Content, string? Excerpt, string? FeaturedImageUrl, int? CategoryId, int? TemplateId);
```

There is no `TemplateDefinition`, `TemplateBlock`, `TemplateField`, or publish-time template-snapshot model anywhere in this API — the block/field template system was retired. A post's body is a single sanitized HTML string (`Content`), and its template is a single explicit foreign key (`TemplateId`) into the fixed catalog.

---

## Endpoints (high level — see issues #30–#34 for finalized contracts)

### Templates — read-only catalog

```
GET /api/templates          — list the fixed catalog (all rows; no admin auth required)
GET /api/templates/{id}     — get a single catalog template
```

There is no `POST`, `PUT`, or `DELETE` for templates. The catalog is application-managed and seeded (`sql/seeds/002_catalog_templates.sql`); nothing in this API creates, edits, or deletes `layout_templates` rows. Any endpoint or repository method that would mutate `layout_templates` is out of scope and must not be added.

### Categories

```
GET    /api/categories           — list all categories (public)
POST   /api/categories           — create category [admin]
GET    /api/categories/{slug}    — get single category by slug (public)
PUT    /api/categories/{id}      — update category [admin]
DELETE /api/categories/{id}      — delete category [admin]
```

Categories carry no template default — there is no `defaultTemplateId` field on the category resource; template selection happens per post. Detailed request/response shapes: issue #31.

### Posts

```
GET    /api/posts                  — list posts [admin] (optional ?status=, ?categoryId= filters)
POST   /api/posts                  — create post draft [admin]
GET    /api/posts/{id}             — get post by id [admin] (any status)
GET    /api/posts/by-slug/{slug}   — get post by slug (public; Published only)
PUT    /api/posts/{id}             — save draft content, including the selected template [admin]
POST   /api/posts/{id}/publish     — transition a post to Published [admin]
DELETE /api/posts/{id}             — delete post [admin]
```

- A post's `TemplateId` is an explicit selection from the read-only catalog (`GET /api/templates`); there is no per-post template-content authoring step and no snapshot to populate at publish time — the renderer always combines the post's *current* `Content` with its *currently selected* catalog template.
- `Content` is accepted from the admin editor as rich HTML and must be sanitized server-side before persistence (see HTML Sanitization below).
- `/api/posts/by-slug/{slug}` must filter to `Published` status only — it is the public endpoint.
- Full request/response DTOs, validation rules, and pagination/filtering shape: issues #32–#33.

### Analytics

```
GET /api/analytics/summary   — 30-day dashboard summary [admin]: views, unique visitors, post-state counts, daily views, top posts
POST /api/analytics/pageview — record a page view (public, called by ui-site)
```

Exact response shape and query implementation: issue #34.

---

## HTML Sanitization

Post `Content` is rich HTML authored in the admin editor. It must be sanitized server-side (allow-listed tags/attributes; no `<script>`, no inline event handlers, no `javascript:`/`data:` URLs) before being persisted or ever echoed back — this API is the trust boundary between admin input and both the stored value and the public renderer. Centralize this in `Common/HtmlSanitizer.cs` so there is exactly one sanitization implementation shared by every write path that touches `posts.content`. The specific library/allow-list is not fixed by this spec; treat it as an implementation detail bounded by "never persist or serve unsanitized post HTML."

---

## Image Upload

The Next.js admin BFF handles upload proxying to SeaweedFS directly (see Admin UI spec). The .NET API does not handle file uploads — it only stores and serves URL strings as post field values (`featured_image_url`, and image URLs embedded in sanitized post `content`).

---

## What the Agent Must NOT Do

- Do not use `dynamic` as a Dapper return type
- Do not use EF Core, no `DbContext`, no migrations via EF
- Do not swallow exceptions silently — all catch blocks must either rethrow or return a structured error response
- Do not add `POST`, `PUT`, or `DELETE` endpoints for `/api/templates` — the catalog is read-only and fixed at three seeded rows
- Do not add a per-post template-content field, a block/field JSONB content model, or any publish-time template-snapshotting behavior to the Posts feature — posts carry a single sanitized HTML `Content` string plus an explicit `TemplateId`
- Do not persist or return post `Content` without passing it through the shared HTML sanitizer first
- Do not return `500` errors with exception stack traces to the client — log the exception server-side, return a generic `ErrorResponse` with code `INTERNAL_ERROR`
- Do not add endpoints that return unpublished (non-`Published`) post content without a validated admin JWT
- Do not invent JWT validation details, pagination shapes, or DTO fields beyond what is stated here — reference the relevant issue (#30–#34) instead

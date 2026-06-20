# Spec: .NET Backend API — Blog Template System

## Target Technology
- .NET 8 minimal API or controller-based REST API (use whichever pattern already exists in the codebase)
- Dapper for all data access — no EF Core, no ORMs
- PostgreSQL via `Npgsql` driver
- All endpoints return `application/json`
- Structured error responses on all failure paths (see Error Contract section)

## Confidence Notes for Agent
- Assume Npgsql is already installed; if not, add `Npgsql` and `Dapper` via NuGet
- Assume dependency injection is configured; register `IDbConnectionFactory` in the DI container
- Do not use `dynamic` for Dapper query results — always map to typed record/class
- PostgreSQL parameter syntax is `@ParamName` with Npgsql/Dapper (not `$1`)

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
      TemplateEndpoints.cs
      TemplateRepository.cs
      TemplateModels.cs
    /Posts
      PostEndpoints.cs
      PostRepository.cs
      PostModels.cs
      PostValidator.cs
  /Infrastructure
    DbConnectionFactory.cs
    Auth.cs
  /Common
    ErrorResponse.cs
    SlugHelper.cs
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

### Auth Abstraction

Single-user MVP uses a static bearer token. The `GetSession` method is the only place this logic lives — when multi-user auth is added, only this method changes.

```csharp
// Infrastructure/Auth.cs
public record Session(string UserId, bool IsAdmin);

public static class Auth
{
    public static Session? GetSession(HttpRequest request, IConfiguration config)
    {
        var header = request.Headers.Authorization.FirstOrDefault();
        var expected = $"Bearer {config["AdminApiKey"]}";

        if (header == expected)
        {
            return new Session(
                UserId: config["AdminUserId"] ?? "admin",
                IsAdmin: true
            );
        }

        return null;
    }
}
```

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
{ "code": "NOT_FOUND", "message": "Post with id 'abc' was not found." }

// 409
{ "code": "CONFLICT", "message": "A category with slug 'tutorials' already exists." }

// 401
{ "code": "UNAUTHORIZED", "message": "Valid admin credentials are required." }
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

## JSONB Handling with Dapper + Npgsql

Dapper does not know about PostgreSQL's `jsonb` type natively. You must handle serialization/deserialization explicitly. Use this pattern consistently across all repositories that touch JSONB columns.

```csharp
// In any repository reading JSONB columns, map the raw string then deserialize:
var rows = await conn.QueryAsync<PostRow>(sql, parameters);

// PostRow has JSONB columns as strings:
public record PostRow(
    Guid Id,
    string Title,
    string Slug,
    string ContentJson,         // maps to posts.content
    string? TemplateSnapshotJson // maps to posts.template_snapshot
);

// Then project to your domain model:
var post = new Post
{
    Id = row.Id,
    Content = JsonSerializer.Deserialize<Dictionary<string, string>>(row.ContentJson)!,
    TemplateSnapshot = row.TemplateSnapshotJson is not null
        ? JsonSerializer.Deserialize<TemplateDefinition>(row.TemplateSnapshotJson)
        : null
};
```

When writing JSONB back, serialize to string and pass as a typed NpgsqlParameter:

```csharp
var param = new NpgsqlParameter("@Definition", NpgsqlTypes.NpgsqlDbType.Jsonb)
{
    Value = JsonSerializer.Serialize(definition)
};
```

Use `System.Text.Json` throughout — not Newtonsoft.

---

## Domain Models

```csharp
// Features/Categories/CategoryModels.cs
public record Category(Guid Id, string Name, string Slug, string? Description, DateTime CreatedAt, DateTime UpdatedAt);
public record CreateCategoryRequest(string Name, string? Description);
public record UpdateCategoryRequest(string Name, string? Description);

// Features/Templates/TemplateModels.cs
public record TemplateDefinition(List<TemplateBlock> Blocks);
public record TemplateBlock(string Id, string Type, int Order, List<TemplateField> Fields, BlockStyles Styles);
public record TemplateField(string Id, string Type, string Label, string? Placeholder, bool Required, int? MaxLength, string? AspectRatio);
public record BlockStyles(string Padding, string Background, int? Columns, string Alignment);

public record Template(Guid Id, Guid CategoryId, string Name, string? Description, TemplateDefinition Definition, DateTime CreatedAt, DateTime UpdatedAt);
public record CreateTemplateRequest(Guid CategoryId, string Name, string? Description, TemplateDefinition Definition);
public record UpdateTemplateRequest(string Name, string? Description, TemplateDefinition Definition);

// Features/Posts/PostModels.cs
public record Post(
    Guid Id, Guid TemplateId, Guid CategoryId,
    string Title, string Slug,
    Dictionary<string, string> Content,
    TemplateDefinition? TemplateSnapshot,
    bool Published, DateTime? PublishedAt,
    DateTime CreatedAt, DateTime UpdatedAt
);
public record CreatePostRequest(Guid TemplateId, Guid CategoryId, string Title, string? Slug);
public record UpdatePostContentRequest(string Title, Dictionary<string, string> Content);
```

---

## Endpoints

### Categories

```
GET    /api/categories           — list all categories
POST   /api/categories           — create category [admin]
GET    /api/categories/{slug}    — get single category by slug
PUT    /api/categories/{id}      — update category [admin]
DELETE /api/categories/{id}      — delete category [admin] (fails if templates or posts exist)
```

**CategoryRepository.cs — key queries:**

```csharp
public async Task<IEnumerable<Category>> GetAllAsync()
{
    using var conn = _factory.CreateConnection();
    return await conn.QueryAsync<Category>(
        "SELECT id, name, slug, description, created_at, updated_at FROM categories ORDER BY name"
    );
}

public async Task<Guid> CreateAsync(string name, string slug, string? description)
{
    using var conn = _factory.CreateConnection();
    return await conn.ExecuteScalarAsync<Guid>(
        @"INSERT INTO categories (name, slug, description)
          VALUES (@Name, @Slug, @Description)
          RETURNING id",
        new { Name = name, Slug = slug, Description = description }
    );
}

public async Task<bool> DeleteAsync(Guid id)
{
    // ON DELETE RESTRICT on templates and posts means this throws
    // Npgsql.PostgresException with SqlState 23503 if references exist.
    // Catch at the endpoint level and return 409.
    using var conn = _factory.CreateConnection();
    var affected = await conn.ExecuteAsync(
        "DELETE FROM categories WHERE id = @Id",
        new { Id = id }
    );
    return affected > 0;
}
```

**CategoryEndpoints.cs — registration pattern:**

```csharp
public static class CategoryEndpoints
{
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/categories");

        group.MapGet("/", async (CategoryRepository repo) =>
        {
            var categories = await repo.GetAllAsync();
            return Results.Ok(categories);
        });

        group.MapPost("/", async (
            CreateCategoryRequest request,
            CategoryRepository repo,
            IConfiguration config,
            HttpContext ctx) =>
        {
            var session = Auth.GetSession(ctx.Request, config);
            if (session is null) return Results.Json(
                new ErrorResponse("UNAUTHORIZED", "Valid admin credentials are required."),
                statusCode: 401);

            if (string.IsNullOrWhiteSpace(request.Name))
                return Results.Json(
                    new ErrorResponse("VALIDATION_FAILED", "Name is required."),
                    statusCode: 400);

            var slug = SlugHelper.Generate(request.Name);

            try
            {
                var id = await repo.CreateAsync(request.Name, slug, request.Description);
                return Results.Created($"/api/categories/{slug}", new { id, slug });
            }
            catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
            {
                return Results.Json(
                    new ErrorResponse("CONFLICT", $"A category with name '{request.Name}' already exists."),
                    statusCode: 409);
            }
        });

        // PUT and DELETE follow the same auth + error pattern — implement analogously

        return app;
    }
}
```

---

### Templates

```
GET    /api/templates                        — list all templates (optional ?categoryId= filter)
POST   /api/templates                        — create template [admin]
GET    /api/templates/{id}                   — get single template by id
PUT    /api/templates/{id}                   — update template [admin]
DELETE /api/templates/{id}                   — delete template [admin] (fails if posts exist)
GET    /api/categories/{categoryId}/templates — templates scoped to a category (used by post creation UI)
```

**TemplateRepository.cs — JSONB write example:**

```csharp
public async Task<Guid> CreateAsync(Guid categoryId, string name, string? description, TemplateDefinition definition)
{
    using var conn = _factory.CreateConnection();
    // Must open the connection manually when using NpgsqlParameter typed parameters
    await ((NpgsqlConnection)conn).OpenAsync();

    var sql = @"
        INSERT INTO templates (category_id, name, description, definition)
        VALUES (@CategoryId, @Name, @Description, @Definition)
        RETURNING id";

    var command = new CommandDefinition(sql, new
    {
        CategoryId = categoryId,
        Name = name,
        Description = description,
        // Pass as NpgsqlParameter to preserve jsonb type info
        Definition = new NpgsqlParameter("@Definition", NpgsqlTypes.NpgsqlDbType.Jsonb)
        {
            Value = JsonSerializer.Serialize(definition)
        }
    });

    // NOTE: Dapper does not support NpgsqlParameter inside anonymous objects cleanly.
    // Use DynamicParameters instead:
    var dp = new DynamicParameters();
    dp.Add("CategoryId", categoryId);
    dp.Add("Name", name);
    dp.Add("Description", description);
    dp.Add("Definition", JsonSerializer.Serialize(definition), DbType.String);

    return await conn.ExecuteScalarAsync<Guid>(sql, dp);
}
```

**Critical rule for template updates:** When updating a template's `definition`, the agent must preserve all existing field `id` values. New fields get new UUIDs; existing fields keep their IDs. The application receives the full updated definition from the client (which already carries existing field IDs) — do not regenerate IDs server-side on update. Simply persist what is received after validating the structure.

```csharp
public async Task<bool> UpdateAsync(Guid id, string name, string? description, TemplateDefinition definition)
{
    // Validate that all block IDs and field IDs in the definition are valid UUIDs
    // Do NOT generate new IDs here — the client is responsible for ID stability
    foreach (var block in definition.Blocks)
    {
        if (!Guid.TryParse(block.Id, out _))
            throw new ArgumentException($"Block id '{block.Id}' is not a valid UUID.");
        foreach (var field in block.Fields)
        {
            if (!Guid.TryParse(field.Id, out _))
                throw new ArgumentException($"Field id '{field.Id}' is not a valid UUID.");
        }
    }

    using var conn = _factory.CreateConnection();
    var dp = new DynamicParameters();
    dp.Add("Id", id);
    dp.Add("Name", name);
    dp.Add("Description", description);
    dp.Add("Definition", JsonSerializer.Serialize(definition), DbType.String);

    var affected = await conn.ExecuteAsync(
        @"UPDATE templates SET name = @Name, description = @Description, definition = @Definition
          WHERE id = @Id",
        dp
    );
    return affected > 0;
}
```

---

### Posts

```
GET    /api/posts                  — list posts (optional ?published=true, ?categoryId=)
POST   /api/posts                  — create post draft [admin]
GET    /api/posts/{id}             — get post by id (admin; includes unpublished)
GET    /api/posts/by-slug/{slug}   — get post by slug (public; published only)
PUT    /api/posts/{id}/content     — save draft content [admin]
POST   /api/posts/{id}/publish     — publish post [admin]
DELETE /api/posts/{id}             — delete post [admin]
```

**PostRepository.cs — the publish transaction:**

```csharp
public async Task PublishAsync(Guid postId)
{
    // This must be atomic: fetch template definition and update post in one transaction.
    // If the template is deleted between the SELECT and the UPDATE, the transaction catches it.
    using var conn = (NpgsqlConnection)_factory.CreateConnection();
    await conn.OpenAsync();
    await using var tx = await conn.BeginTransactionAsync();

    try
    {
        // Lock the post row to prevent double-publish race conditions
        var post = await conn.QuerySingleOrDefaultAsync<(Guid Id, Guid TemplateId, bool Published)>(
            "SELECT id, template_id, published FROM posts WHERE id = @Id FOR UPDATE",
            new { Id = postId },
            transaction: tx
        );

        if (post == default)
            throw new KeyNotFoundException($"Post '{postId}' not found.");

        if (post.Published)
            throw new InvalidOperationException("Post is already published.");

        // Fetch the live template definition to snapshot
        var templateDefinitionJson = await conn.ExecuteScalarAsync<string>(
            "SELECT definition FROM templates WHERE id = @Id",
            new { Id = post.TemplateId },
            transaction: tx
        );

        if (templateDefinitionJson is null)
            throw new InvalidOperationException("Template not found — cannot publish without a valid template.");

        await conn.ExecuteAsync(
            @"UPDATE posts
              SET template_snapshot = @Snapshot::jsonb,
                  published = true,
                  published_at = now()
              WHERE id = @Id",
            new { Snapshot = templateDefinitionJson, Id = postId },
            transaction: tx
        );

        await tx.CommitAsync();
    }
    catch
    {
        await tx.RollbackAsync();
        throw;
    }
}
```

**PostEndpoints.cs — publish endpoint with validation:**

```csharp
group.MapPost("/{id:guid}/publish", async (
    Guid id,
    PostRepository postRepo,
    PostValidator validator,
    IConfiguration config,
    HttpContext ctx) =>
{
    var session = Auth.GetSession(ctx.Request, config);
    if (session is null) return Results.Json(
        new ErrorResponse("UNAUTHORIZED", "Valid admin credentials are required."),
        statusCode: 401);

    // Validate required fields before publishing
    var post = await postRepo.GetByIdAsync(id);
    if (post is null) return Results.Json(
        new ErrorResponse("NOT_FOUND", $"Post '{id}' not found."),
        statusCode: 404);

    // Fetch the live template to validate against
    var template = await templateRepo.GetByIdAsync(post.TemplateId);
    var validationErrors = validator.ValidateContent(post.Content, template!.Definition);

    if (validationErrors.Any())
        return Results.Json(
            new ErrorResponse("VALIDATION_FAILED", "Required fields are missing or empty.", validationErrors),
            statusCode: 422);

    try
    {
        await postRepo.PublishAsync(id);
        return Results.Ok(new { published = true });
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new ErrorResponse("CONFLICT", ex.Message), statusCode: 409);
    }
});
```

---

## PostValidator

This is where required field validation and the Tiptap empty-document case are handled.

```csharp
// Features/Posts/PostValidator.cs
using System.Text.Json;

public class PostValidator
{
    // Tiptap produces this structure for an empty document (user opened editor, typed nothing).
    // A paragraph node with no text children is visually empty but structurally non-empty JSON.
    // We must detect both forms.
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public Dictionary<string, string[]> ValidateContent(
        Dictionary<string, string> content,
        TemplateDefinition definition)
    {
        var errors = new Dictionary<string, string[]>();

        foreach (var block in definition.Blocks)
        {
            foreach (var field in block.Fields)
            {
                if (!field.Required) continue;

                content.TryGetValue(field.Id, out var value);

                var isEmpty = field.Type switch
                {
                    "rich-text" => IsRichTextEmpty(value),
                    "tag-list"  => string.IsNullOrWhiteSpace(value) || value == "[]",
                    _           => string.IsNullOrWhiteSpace(value)
                };

                if (isEmpty)
                {
                    errors[field.Id] = new[] { $"'{field.Label}' is required." };
                }
            }
        }

        return errors;
    }

    private static bool IsRichTextEmpty(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return true;

        try
        {
            var doc = JsonSerializer.Deserialize<TiptapDocument>(json, _jsonOptions);
            if (doc?.Content is null || doc.Content.Count == 0) return true;

            // A single paragraph node with no children (or only empty text nodes) is empty
            return doc.Content.All(node =>
                node.Type == "paragraph" &&
                (node.Content is null || node.Content.Count == 0 ||
                 node.Content.All(child => child.Type == "text" &&
                                           string.IsNullOrEmpty(child.Text))));
        }
        catch (JsonException)
        {
            // Unparseable content is treated as empty — do not publish malformed rich text
            return true;
        }
    }

    // Minimal deserialization targets for Tiptap JSON — only what we need for empty detection
    private record TiptapDocument(string Type, List<TiptapNode>? Content);
    private record TiptapNode(string Type, List<TiptapNode>? Content, string? Text);
}
```

---

## Image Upload Endpoint

The Next.js layer handles upload proxying to SeaweedFS (see Admin UI spec). The .NET API does not handle file uploads — it only stores and serves URL strings as field values within post content. If the project architecture later requires the .NET API to proxy uploads, add it then.

---

## What the Agent Must NOT Do

- Do not use `dynamic` as a Dapper return type
- Do not use EF Core, no `DbContext`, no migrations via EF
- Do not swallow exceptions silently — all catch blocks must either rethrow or return a structured error response
- Do not generate new UUIDs for existing template field IDs on update operations
- Do not return `500` errors with exception stack traces to the client — log the exception server-side, return a generic `ErrorResponse` with code `INTERNAL_ERROR`
- Do not add endpoints that return unpublished post content without an admin session check
- The `/api/posts/by-slug/{slug}` endpoint must filter `WHERE published = true` — it is the public endpoint

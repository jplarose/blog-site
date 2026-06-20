# Template Editor API Task List

The request is to align the .NET API with the template editor contract in [ui-admin/template-editor-api-contracts.md](/home/jlarose/Dev/Blog-site/ui-admin/template-editor-api-contracts.md), specifically by filling the missing or incomplete template/category/post endpoints, adding explicit HTTP and response metadata on controllers, introducing a service layer that returns `Result`/`Result<T>` and maps those outcomes to HTTP responses, and updating the SQL schema to support layout JSON and per-post template content. Important constraints from the current codebase: the existing API is controller+EF-only, not Dapper-based, it does not use a result pattern yet, and the current schema/models still use `html_structure`/`css_styles` rather than the `TemplateLayout` contract shape.

## Tasks

### 1. Audit and reshape the template editor API contract surface

- **Assigned Agent(s):** Clean C# / .NET Backend Engineer
- **Goal:** Identify the exact controller actions and DTO changes needed so `LayoutTemplatesController`, `CategoriesController`, and `PostsController` match the spec and expose correct OpenAPI metadata.
- **Likely files/areas touched:** `/home/jlarose/Dev/Blog-site/api/Controllers/LayoutTemplatesController.cs`, `/home/jlarose/Dev/Blog-site/api/Controllers/CategoriesController.cs`, `/home/jlarose/Dev/Blog-site/api/Controllers/PostsController.cs`, `/home/jlarose/Dev/Blog-site/api/DTOs/LayoutTemplateDtos.cs`, `/home/jlarose/Dev/Blog-site/api/DTOs/CategoryDtos.cs`, `/home/jlarose/Dev/Blog-site/api/DTOs/PostDtos.cs`
- **Acceptance criteria:** All contract-required endpoints are present; request/response DTOs represent `TemplateLayout` and `PostTemplateContent`; each action has the correct HTTP verb and response type decorators; missing response shapes like template list summaries and post template content are defined.
- **Dependencies:** None
- **Risks / unknowns:** The spec leaves delete behavior open when a template is referenced; the current DTOs use tag IDs while the UI contract references tag names/strings in places.

### 2. Introduce backend service/result flow for template, category, and post mutations

- **Assigned Agent(s):** Clean C# / .NET Backend Engineer
- **Goal:** Move controller business logic into services that return `Result` values and keep controllers focused on request validation and HTTP mapping.
- **Likely files/areas touched:** `/home/jlarose/Dev/Blog-site/api/Program.cs`, new `api/Services/**`, new `api/Results/**`, updated controllers under `/home/jlarose/Dev/Blog-site/api/Controllers/**`
- **Acceptance criteria:** Controllers delegate to services; expected failures return `Result`/`Result<T>` with stable codes/messages; controllers map success/failure to `Ok`, `Created`, `NoContent`, `BadRequest`, `NotFound`, or `Conflict` as appropriate; cancellation tokens flow through the new service methods.
- **Dependencies:** Task 1
- **Risks / unknowns:** The repo guidance prefers Dapper, so the service design should avoid cementing more EF-centric patterns if a data-access shift is needed immediately.

### 3. Bring persistence and schema in line with the template editor data model

- **Assigned Agent(s):** PostgreSQL / DB Operations Expert, Clean C# / .NET Backend Engineer
- **Goal:** Replace the current template storage shape with a backend-safe JSON layout model and add storage for post-level template content and any counts or relationships needed by the new endpoints.
- **Likely files/areas touched:** `/home/jlarose/Dev/Blog-site/sql/migrations/001_initial_schema.sql`, `/home/jlarose/Dev/Blog-site/sql/seeds/001_seed_data.sql`, `/home/jlarose/Dev/Blog-site/api/Models/LayoutTemplate.cs`, `/home/jlarose/Dev/Blog-site/api/Models/Post.cs`, `/home/jlarose/Dev/Blog-site/api/Data/BlogDbContext.cs`
- **Acceptance criteria:** Schema supports saving `TemplateLayout` as JSON and post template content as JSON; foreign keys for category default templates and post template assignment remain valid; seed data matches the new column model; API models/data access can read and write the new structure cleanly.
- **Dependencies:** Task 1
- **Risks / unknowns:** Whether to store layout/content as `jsonb` blobs only or split any searchable fields; whether `content` on posts remains alongside `template_content` or becomes optional legacy data.

### 4. Align data access with repo standards for template editor operations

- **Assigned Agent(s):** Clean C# / .NET Backend Engineer
- **Goal:** Implement the new endpoint/service persistence using the repo’s stated Dapper + manual SQL + result-pattern conventions instead of extending the current EF-only approach.
- **Likely files/areas touched:** `/home/jlarose/Dev/Blog-site/api/Program.cs`, new `api/Data/**` or `api/Services/**`, `/home/jlarose/Dev/Blog-site/api/BlogSite.Api.csproj`
- **Acceptance criteria:** New template/category/post reads and writes use parameterized SQL through Dapper; SQL is explicit and readable; multi-step operations that must stay consistent are transactional; controllers/services no longer rely on exceptions for normal flow.
- **Dependencies:** Tasks 1 and 3
- **Risks / unknowns:** This may widen the change scope because the existing API is entirely EF-based; mixing EF and Dapper temporarily is possible, but consistency needs to be decided during execution.

### 5. Verify contract behavior and review change risk

- **Assigned Agent(s):** QA Testing and Automation Expert, PR Review Guardian
- **Goal:** Add only high-signal verification around the new contract and review the change for correctness, regressions, and schema/API mismatches.
- **Likely files/areas touched:** test project if present or new targeted tests under `api`; otherwise verification notes against controllers/services/SQL
- **Acceptance criteria:** High-value tests or justified manual verification cover create/update/delete/list/get flows, not-found and validation cases, template reference constraints, and result-to-HTTP mapping; review notes call out any must-fix gaps before PR.
- **Dependencies:** Tasks 2, 3, and 4
- **Risks / unknowns:** There does not appear to be an existing API test project yet, so verification may require adding one or documenting a focused manual test matrix.

## Suggested execution order

1. Task 1
2. Task 3
3. Task 2
4. Task 4
5. Task 5

## Stop

STOP

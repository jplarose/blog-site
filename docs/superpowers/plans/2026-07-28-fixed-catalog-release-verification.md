# Fixed Template Catalog — Release Verification (Issue #44)

**Date:** 2026-07-28
**Branch:** `epic/Admin-Page-Refactor`
**Scope:** Cross-system verification of the fixed-template-catalog release (epics #18–#23, issues #24–#43), before merge to `main`.

This is the final task of the release: prove the critical security and content flows with automated evidence, run the full build/lint/test matrix across all three apps, and close any genuine coverage gaps without adding new test infrastructure.

## 1. Verification run — commands and results

| App | Command | Result |
|---|---|---|
| `api` | `MSBuildEnableWorkloadResolver=false dotnet build` | **Build succeeded**, 0 errors, 4 warnings |
| `api.Tests` | `MSBuildEnableWorkloadResolver=false dotnet test api.Tests` | **227/227 passed** (0 failed, 0 skipped) |
| `ui-admin` | `npm run lint` | **Clean**, 0 errors/warnings |
| `ui-admin` | `npm run build` | **Succeeded** (Next.js 16.1.6 / Turbopack, 20 routes) |
| `ui-admin` | `npm test` (vitest) | **214/214 passed**, 37 test files |
| `ui-site` | `npm run lint` | **Clean**, 0 errors/warnings |
| `ui-site` | `npm run build` | **Succeeded** (Next.js 16.1.6 / Turbopack, 6 routes) |
| `ui-site` | `npm test` (vitest) | **80/80 passed**, 6 test files |

**api.Tests count:** 223 baseline (pre-existing on this branch) + 4 added in this task (§3) = 227.

### Notes on the commands

- **`dotnet build`/`dotnet test` require `MSBuildEnableWorkloadResolver=false`** in this sandbox. The local dotnet 10.0.110 SDK has a broken workload-set manifest (`error MSB4242: ... Workload set version 10.0.109.1 has missing manifests likely removed by package management. Run "dotnet workload repair" to fix this.`) — a known, pre-existing local environment issue, not a project defect. `dotnet workload repair` was not run (would mutate a sandboxed, possibly shared SDK install); the resolver bypass is the documented workaround and does not change compiled output — it only skips workload-based SDK resolution, which this project (no mobile/wasm workloads) doesn't use.
- **`api` build warnings** are exactly the two pre-existing NuGet advisories already tracked in the deferred-minors list: `NU1902` (AngleSharp 0.17.1, transitive via Ganss.Xss HtmlSanitizer) and `NU1903` (Microsoft.OpenApi 2.0.0). No new warnings.
- **`ui-admin` build** emits one Next.js framework notice ("The 'middleware' file convention is deprecated. Please use 'proxy' instead.") — informational, not an error; out of scope for this release (framework migration, not a functional gap).
- No other failing tests, build errors, or lint violations were observed anywhere in the matrix. Nothing was skipped, masked, or weakened to make a suite pass.

## 2. Coverage audit — workflow → test traceability

| # | Critical workflow | API coverage (`api.Tests`) | ui-admin coverage (vitest) | ui-site coverage (vitest) |
|---|---|---|---|---|
| 1 | **Login/session** (BFF cookies, JWT+JTI) | `Auth/AuthenticationTests.cs` (10 cases: no-token 401 matrix, public-GET allowlist, valid token passthrough, expired/wrong-signature/wrong-issuer/wrong-audience/garbage token → 401, revoked JTI → 401), `Infrastructure/AuthApiJtiValidatorTests.cs` (5 cases: fail-closed on timeout/error) | `__tests__/login-page.test.tsx` (form → `POST /api/auth/login`, success navigates to `/dashboard`, 401 shows inline error, pending-state disables submit), `__tests__/auth/auth-routes.test.ts` (13 cases: HttpOnly cookie set/maxAge, 401 on bad creds, 400 on missing fields w/o calling upstream, 502 without leaking upstream details, refresh rotation, logout cookie clearing), `__tests__/auth/session.test.ts`, `__tests__/auth/auth-api.test.ts`, `__tests__/middleware.test.ts` (7 cases: redirect gate, 401 JSON for API routes, cookie passthrough), `__tests__/api-proxy.test.ts`, `__tests__/api-client-auth.test.ts` | n/a (public site has no auth) |
| 2 | **Catalog (template) selection** | `Auth/LayoutTemplateCatalogTests.cs` (5 cases: GET-only summary/detail contract, unknown template 400 on post write) | `__tests__/post-editor-template-selection.test.tsx`, `__tests__/template-cards.test.tsx`, `__tests__/template-preview.test.tsx`, `__tests__/template-tokens.test.ts` | `__tests__/render-template.test.ts` (token substitution against the three catalog templates' token set) |
| 3 | **Post publishing lifecycle** | `Auth/PostLifecycleTests.cs` (10 cases: publish/schedule/archive happy-path + 404/400/409 per transition, non-UTC offset scheduling), `Auth/PostFlowChainTests.cs` (chained create→schedule→publish, **new**, see §3), `Auth/PostSanitizationTests.cs` (6 cases: sanitization applied on create/update) | `__tests__/schedule-dialog.test.tsx`, `__tests__/post-row-actions.test.tsx`, `__tests__/posts-schedule-helpers.test.ts`, `__tests__/posts-page.test.tsx`, `__tests__/post-list-table.test.tsx`, `__tests__/post-list-filters.test.tsx` | n/a |
| 4 | **Public rendering + unpublished exclusion** | `Auth/PublicPostReadsTests.cs` (9 cases: identity-branching list/get-by-id/get-by-slug, Draft/Scheduled/Archived → 404 anonymous, authenticated sees all), `Common/PostHtmlSanitizerTests.cs` (21 cases) | n/a | `__tests__/render-template.test.ts` (28 cases: escaping, scheme filtering on `featuredImage`, conditional sections, missing-field resilience), `__tests__/blog-slug-page.test.ts` (3 cases incl. explicit #33 regression: `ApiNotFoundError` → null, not just generic failure), `__tests__/category-slug-page.test.ts`, `__tests__/api.test.ts`, `__tests__/metadata.test.ts` |
| 5 | **Taxonomy management** | `Auth/TaxonomyMutationTests.cs` (13 cases: duplicate-name/slug 409, invalid 400, referenced-delete 409, missing 404, for both categories and tags), `Services/CategoryServiceTests.cs` (12 cases), `Services/TagServiceTests.cs` (10 cases) | `__tests__/categories-manager.test.tsx` (12 cases incl. stale-row 404 handling), `__tests__/tags-manager.test.tsx` (9 cases), `__tests__/taxonomy-table.test.tsx`, `__tests__/taxonomy-form-modal.test.tsx`, `__tests__/taxonomy-error-message.test.ts`, `__tests__/confirm-delete-taxonomy-dialog.test.tsx` | `__tests__/category-link.test.ts` |
| 6 | **Dashboard metrics** | `Auth/AnalyticsSummaryTests.cs` (7 cases), `Common/AnalyticsAggregationTests.cs` (7 cases), `Common/AnalyticsWindowTests.cs` (6 cases: window validation/boundaries) | `__tests__/dashboard-page.test.tsx` (5 cases: 30-day summary request, stat tiles, top posts, friendly error + retry, generic message for 500), `__tests__/daily-views-chart.test.tsx`, `__tests__/dashboard-chart-math.test.ts`, `__tests__/top-posts-list.test.tsx`, `__tests__/use-analytics-summary.test.ts`, `__tests__/api-analytics-route.test.ts` | n/a |

Supporting/infrastructure coverage not tied to a single workflow above: `Services/PostServiceTests.cs` (27 cases), `Services/MediaServiceTests.cs` / `Controllers/MediaControllerTests.cs` / `Storage/SeaweedFilerImageStoreTests.cs` (image upload path), `Extensions/AddImageStorageExtensionTests.cs` / `AddPostgresExtensionTests.cs` (DI wiring), `__tests__/image-upload-control.test.tsx`, `__tests__/post-editor-image-upload.test.tsx`, `__tests__/modal.test.tsx`, `__tests__/pagination-controls.test.tsx`, `__tests__/confirm-delete-dialog.test.tsx`, `__tests__/admin-nav.test.tsx`.

## 3. Gaps filled

The brief called out three specific candidates to verify against the existing suite and fill only if a genuine gap existed.

| Candidate | Verdict | Action | Commit |
|---|---|---|---|
| API flow chain: authenticated create-post-with-catalog-template → schedule → publish → anonymous read sees it; anonymous read of draft/scheduled/archived 404s | **Genuine gap.** `PostLifecycleTests` and `PublicPostReadsTests` each cover their piece in isolation (schedule 200, publish 200, anonymous-404-on-non-published as separate `[Fact]`s with independently-seeded fake state) but no test drives the *sequence* through the real controller/service pipeline with one client identity for the writes and a second for the reads. | Added `api.Tests/Auth/PostFlowChainTests.cs` — `CreateScheduleThenPublish_ThenAnonymousReadsSeeIt` runs authenticated create → schedule → publish in order (asserting the status at each step), interleaved with anonymous-client reads by id and by slug that 404 while Draft/Scheduled/Archived and succeed only once Published. | `test(#44): add authoring-to-publication flow chain test` |
| Auth: expired/garbage JWT rejected on a protected write; revoked JTI rejected | **Partial gap.** Expired, wrong-signature, wrong-issuer, wrong-audience, and revoked-JTI were already covered in `AuthenticationTests.cs` (#28). A structurally malformed ("garbage", non-JWT-shaped) bearer token was not exercised. | Added `GarbageToken_Returns401` theory to `AuthenticationTests.cs` (`"not-a-jwt-at-all"`, `"also.not.valid.base64!!"`, `""`) — 3 cases. | `test(#44): add authoring-to-publication flow chain test` (same commit, both new test files) |
| ui-admin: login form → BFF route interaction | **No gap.** `login-page.test.tsx` already asserts the form posts JSON (`identifier`/`password`) to `/api/auth/login`, navigates on success, and surfaces the 401 error inline; `auth/auth-routes.test.ts` covers the BFF side (cookie setting, upstream failure handling). | None. | — |

No production code was modified — no defect was exposed by the new tests. New `api.Tests` total: 223 → **227**, all passing.

## 4. Residual risks and manual-only checks

These are known, accepted gaps in *automated* coverage, not defects:

- **Destructive migration `sql/migrations/003_fixed_template_catalog_reset.sql`** has only ever been run against scratch Postgres instances. It has not been (and per `sql/README.md`, must not be) run against the shared dev database until the fixed-catalog API ships — running it early breaks the currently-deployed API. This is a deploy-sequencing risk, not something a test suite can catch; it is a manual gate at release time.
- **No browser-level E2E harness** (Playwright or similar) exists in this repo. All "flow" coverage — including the new chain test in §3 — runs through `api.Tests`' `WebApplicationFactory` HTTP harness (real controller/service/middleware pipeline, fake repositories) or `ui-admin`/`ui-site` component-level vitest tests with mocked network calls. There is no test that drives a real browser against a running instance of all three apps together (e.g., an admin login → publish → verify on the live public site, through actual cookies and CORS). This is a known, accepted gap for this release given the "no new infra" constraint in the task brief.
- **Schedule endpoint has no background scheduler** (documented in `PostService.ScheduleAsync`/`PostsController`): a Scheduled post only becomes Published via an explicit `/publish` call after the scheduled time passes. This is a product design decision, not a test gap, but worth flagging for anyone expecting cron-like auto-publish behavior.

## 5. Deferred minors — status

Carried over from `docs/superpowers/plans/2026-07-26-fixed-template-catalog-status.md`. None were fixed in this task (out of scope — verification pass only); status re-confirmed as still present and non-blocking for release:

| Item | Status |
|---|---|
| `featuredImageUrl` not sanitized as a URL at write time | Still open. Mitigated at render time — `ui-site`'s `renderTemplate` scheme-filters `featuredImage` before inserting it into `src` (`render-template.test.ts` covers `javascript:`/`data:` stripping, including a control-character-hidden scheme). Write-side validation remains a follow-up. |
| `{{featuredImage}}` substitution into `src` — covered by the same scheme-filtering as above | Still open as originally scoped (predates branch), same mitigation as above. |
| Sanitizer's per-tag attribute scoping is manual (`api/Common/PostHtmlSanitizer.cs`) | Still open; documented in code as the update point if the allowlist changes. |
| `ui-admin`'s `jsonResponse` helper duplicated across the three auth routes | Still open; no functional impact. |
| Taxonomy deletes make an extra `GetById` round trip | Still open; no functional impact. |
| Category/tag name uniqueness is app-level only (slug has a DB index) | Still open; enforced at the service layer (`TaxonomyMutationTests.cs` covers the 409 path), not the database. |
| `NU1902` (AngleSharp 0.17.1) / `NU1903` (Microsoft.OpenApi) advisories | Still open; confirmed present in this run's build output (§1), unchanged from the prior status doc. |

None of these block release; all were already triaged as deferred in the prior status doc and none surfaced new severity in this verification pass.

## 6. Bottom line

All three apps build, lint, and test clean. All six critical workflows named in the release scope have direct, named automated coverage, confirmed by the traceability table in §2. Two genuine coverage gaps were identified and closed with new tests only (no production code changes, no new test infrastructure); one candidate gap was checked and found already covered. The only residual risks are a documented manual deploy-sequencing step (migration 003) and the well-understood absence of a cross-app browser E2E harness — both accepted for this release under the task's "no new infra" constraint.

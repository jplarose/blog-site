# Fixed Template Catalog — Implementation Status

**Date:** 2026-07-26
**Branch:** `epic/Admin-Page-Refactor` (pushed to origin; not yet merged to `main`)
**Plan:** [2026-07-25-fixed-template-catalog-implementation.md](2026-07-25-fixed-template-catalog-implementation.md)

## Completed

### Epic #18 — Replace custom templates with a fixed catalog ✅

| Issue | Commits | Delivered |
|---|---|---|
| #24 destructive migration | `b8db88b` | `sql/migrations/003_fixed_template_catalog_reset.sql`: deletes posts/post_tags/page_views/templates; drops `posts.template_content`, `layout_templates.layout_json`/`is_default`, `categories.default_template_id`; adds `template_key` unique. Verified against a real scratch Postgres, idempotent. Both application paths documented in `sql/README.md`. |
| #25 seed catalog | `ec7e65c` | `sql/seeds/002_catalog_templates.sql`: exactly three read-only templates (`article`, `feature`, `photo-essay`), upsert on `template_key`, scoped inert HTML/CSS rendering `{{title}} {{content}} {{excerpt}} {{featuredImage}} {{publishedAt}} {{category}} {{tags}}`. Stale template insert removed from seed 001. |
| #26 retire specs | `f2fc2ed`, `4bab3a6`, `0a07403` | All four `docs/specs/SPEC_*.md` + READMEs describe only the fixed-catalog model; routes/renderTemplate signature aligned to real code; reset warning added to `sql/README.md`. |

### Epic #19 — Secure the admin with the shared Auth API ✅

| Issue | Commits | Delivered |
|---|---|---|
| #27 BFF auth routes | `9e7c5a4`, `e9e74f3` | ui-admin: `lib/auth/session.ts` (HttpOnly `admin_access_token`/`admin_refresh_token` cookies), `lib/auth/auth-api.ts` (login-internal/refresh-token-internal/logout with X-Api-Key), `/api/auth/{login,refresh,logout}` routes, wired login page. Tokens never reach client JS. Env: `AUTH_API_BASE_URL`, `AUTH_API_KEY` (see ui-admin/README.md). |
| #28 API JWT + revocation | `e2cf88e`, `2735563` | HS256 JWT bearer auth (issuer `auth.jlarose.me`, audience configurable, `MapInboundClaims=false`), per-request JTI revocation check against `/Auth/validate-jti` (fail-closed, 5s timeout), `[Authorize]`/`[AllowAnonymous]` split across all controllers. Config section `Auth` (`Jwt:Secret/Issuer/Audience`, `BaseUrl`, `ApiKey`). |
| #29 admin guards | `83312a8` | `ui-admin/middleware.ts` (cookie-presence gate, /login redirect, 401 JSON for APIs), proxy attaches Bearer server-side + one refresh retry with rotated cookies, browser cookie/authorization headers no longer forwarded, sign-out in admin nav, client 401 → /login. |

### Epic #20 — Public and administration API contracts ✅

| Issue | Commits | Delivered |
|---|---|---|
| #30 read-only catalog contracts | `8e8b9f9` | LayoutTemplates: GET-only (summary: id/templateKey/name/description; detail adds htmlStructure/cssStyles); POST/PUT/DELETE removed. `templateContent` gone from post contracts; `TemplateId` required + catalog-validated (400). |
| #31 post lifecycle | `d338503`, `22e3d5b` | `POST /api/posts/{id}/schedule` (DateTimeOffset, strictly future, Draft/Scheduled only, 409 otherwise) and `/archive` (idempotent, any state); publish realigned (idempotent, `published_at=COALESCE(...)`, clears `scheduled_at`). No background scheduler — documented on the endpoint. |
| #32 taxonomy APIs | `40863a7` | `DefaultTemplateId` fully removed; explicit failure matrix for categories+tags (duplicate 409, invalid 400, referenced-delete 409, missing 404); post writes take `TagIds` of managed tags (unknown → 400); free-form tag upsert path removed. |
| #33 public reads | `9072181` | Identity-branching: anonymous list forced to Published (SQL-level), single reads 404 for non-Published; authenticated admin keeps full access. Categories/tags/catalog GETs + pageview POST stay public. |
| #34 sanitization + boundaries | `12edb59`, `4f508fc` | `api/Common/PostHtmlSanitizer.cs` (Ganss.Xss HtmlSanitizer 9.0.892): explicit allowlist, scheme filtering (relative URLs kept; `javascript:`/`data:` stripped; `mailto:` links only), `rel="noopener noreferrer"` forced, per-tag attribute scoping; Title/Excerpt decoded plain text. Applied at create/update before persistence. Boundary matrix test class traces all #34 acceptance items. |

**Test state at `4f508fc`:** api 195/195 (xunit incl. WebApplicationFactory integration harness), ui-admin 69/69 (vitest), lint/build clean both.

## Remaining

- **Epic #21 — Rebuild the admin content workspace** (next up)
  - #35 remove custom-template authoring UI/nav (templates routes, canvas/editor components, `template-*` libs and tests) — **first task on resume**
  - #36 catalog selection + preview in post editor
  - #37 post list/lifecycle/deletion UX against the new contract (note: ui-admin still sends the old post shape — free-form `tags`, no required `templateId`; #36/#37 fix this)
  - #38 category/tag management UX (new TagIds contract; referenced-delete 409 surfacing)
- **Epic #22 — Public rendering** — #39 renderer for the catalog (note: `ui-site/lib/api.ts` still references removed `defaultTemplateId` fields), #40 published-post pages + ISR, #41 tests
- **Epic #23 — Dashboard + release** — #42 30-day analytics API contract, #43 admin dashboard, #44 cross-system verification

## Deferred minors (triage at final review / relevant issue)

- `featuredImageUrl` not sanitized as URL (follow-up in #39/#34 scope decision).
- `{{featuredImage}}` substituted unescaped into `src` attribute by the public renderer (predates branch; fold into #39).
- Sanitizer's per-tag attribute scoping is manual (documented in code) — second place to update if allowlist changes.
- ui-admin: `jsonResponse` helper duplicated across the three auth routes; refresh 502 path keeps cookies (deliberate).
- Taxonomy deletes make an extra `GetById` round trip; category/tag *name* uniqueness is app-level only (slug has DB index).
- NU1902 (AngleSharp 0.17.1, transitive via HtmlSanitizer) and pre-existing NU1903 (Microsoft.OpenApi) advisories.

## Process notes

- Executed via subagent-driven development; per-task ledger: `.superpowers/sdd/progress.md` (worktree-local, git-ignored). Resume point: Task 12 = issue #35.
- The destructive migration 003 has been run only against scratch databases. Running it on the shared dev DB will break the *deployed* API until the fixed-catalog code on this branch ships (warning in `sql/README.md`).

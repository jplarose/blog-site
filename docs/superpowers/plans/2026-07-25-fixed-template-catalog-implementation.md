# Fixed Template Catalog Implementation

## Objective

Replace user-authored post templates with a trusted database catalog containing
**Article**, **Feature**, and **Photo Essay**. The admin becomes a secured,
single-owner workspace for posts, categories, tags, and 30-day performance
reporting. No application-code implementation is included in this planning
commit.

## Issue hierarchy

### [#18 — Replace custom templates with a fixed catalog](https://github.com/jplarose/blog-site/issues/18)

- [#24 — Add destructive development migration for the fixed template catalog](https://github.com/jplarose/blog-site/issues/24)
- [#25 — Seed Article, Feature, and Photo Essay catalog templates](https://github.com/jplarose/blog-site/issues/25)
- [#26 — Retire custom-template specifications and layout artifacts](https://github.com/jplarose/blog-site/issues/26)

### [#19 — Secure the admin with the shared Auth API](https://github.com/jplarose/blog-site/issues/19)

- [#27 — Implement Auth API BFF login, refresh, and logout routes](https://github.com/jplarose/blog-site/issues/27)
- [#28 — Enforce BlogSite API JWT and revocation validation](https://github.com/jplarose/blog-site/issues/28)
- [#29 — Guard admin pages and proxy routes with authenticated sessions](https://github.com/jplarose/blog-site/issues/29)

### [#20 — Establish public and administration API contracts](https://github.com/jplarose/blog-site/issues/20)

- [#30 — Replace editable-template API contracts with read-only catalog contracts](https://github.com/jplarose/blog-site/issues/30)
- [#31 — Build protected administration APIs for posts and publishing](https://github.com/jplarose/blog-site/issues/31)
- [#32 — Build protected category and tag administration APIs](https://github.com/jplarose/blog-site/issues/32)
- [#33 — Restrict public BlogSite API reads to published content](https://github.com/jplarose/blog-site/issues/33)
- [#34 — Sanitize rich post HTML and test fixed-catalog API boundaries](https://github.com/jplarose/blog-site/issues/34)

### [#21 — Rebuild the admin content workspace](https://github.com/jplarose/blog-site/issues/21)

- [#35 — Remove custom-template authoring UI and navigation](https://github.com/jplarose/blog-site/issues/35)
- [#36 — Add catalog selection and preview to the post editor](https://github.com/jplarose/blog-site/issues/36)
- [#37 — Complete admin post list, lifecycle actions, and deletion UX](https://github.com/jplarose/blog-site/issues/37)
- [#38 — Complete admin category and tag management UX](https://github.com/jplarose/blog-site/issues/38)

### [#22 — Render fixed catalog templates on the public site](https://github.com/jplarose/blog-site/issues/22)

- [#39 — Implement public renderer for the fixed template catalog](https://github.com/jplarose/blog-site/issues/39)
- [#40 — Update public pages for published catalog posts and ISR](https://github.com/jplarose/blog-site/issues/40)
- [#41 — Test public catalog rendering and unpublished-post exclusion](https://github.com/jplarose/blog-site/issues/41)

### [#23 — Deliver 30-day dashboard reporting and release verification](https://github.com/jplarose/blog-site/issues/23)

- [#42 — Finalize the 30-day analytics API contract](https://github.com/jplarose/blog-site/issues/42)
- [#43 — Build the live 30-day admin performance dashboard](https://github.com/jplarose/blog-site/issues/43)
- [#44 — Run cross-system verification for the fixed-catalog release](https://github.com/jplarose/blog-site/issues/44)

## Delivery workflow

1. Complete #24, #25, and #26 as the database/catalog foundation. The migration
   is destructive and is limited to a development or otherwise disposable
   database.
2. Complete #27 and #28 in parallel, then #29. Browser calls use the Next.js
   BFF; tokens live only in secure HttpOnly cookies. BlogSite API validates the
   shared Auth API JWT issuer, audience, symmetric key, and revocation JTI.
3. Complete #30 before API consumers. #31 and #32 may run in parallel after
   #30; #33 and #34 follow once their required contracts are available.
4. In parallel after API dependencies settle, deliver the admin lane (#35 →
   #36 → #37, with #38 independent after #32) and public lane (#39 → #40 →
   #41). These lanes are isolated to `ui-admin/**` and `ui-site/**`.
5. Complete #42, then #43, and finish with #44 after the security, authoring,
   rendering, taxonomy, and analytics flows are ready.

```text
Database: #24 → #25 → #26
Security: #27 ─┐
          #28 ─┴→ #29
API:      (#25 + #28) → #30 → #31 ─┐
                                  ├→ #36 → #37
                             #32 ─┴────────→ #38
                             #33 → #42 → #43
                             #34
Public:   (#25 + #30 + #33 + #34) → #39 → #40 → #41
Release:  (#29 + #37 + #38 + #41 + #43) → #44
```

## Conflict controls

- Only one child issue at a time changes shared API DTOs/routes: #30 first,
  then #31/#32, then #33/#34.
- Database migration/catalog changes are isolated to `sql/**`.
- Security work is isolated to session/BFF modules and API authentication
  configuration; coordinate the final proxy contract in #29.
- Admin taxonomy work (#38) should not overlap the post-editor work (#36/#37)
  unless each branch limits edits to its stated components.
- Public rendering work is isolated to `ui-site/**` and can proceed alongside
  admin work once public API contracts are stable.
- Parent checklists and child dependency sections are the release source of
  truth; each child PR should reference its child issue and avoid unrelated
  cleanup.

## Superseded work

Issues #7–#14 and #17 describe the prior user-authored template direction and
are closed as superseded by this hierarchy. Media issues #4, #5, #15, and #16
are intentionally unchanged.

## Fixed decisions

- Posts explicitly select a catalog template; categories do not assign
  defaults.
- The catalog is stored in the database but is seeded and application-managed,
  not editable through the admin.
- The initial catalog has Article, Feature, and Photo Essay designs.
- Existing posts, custom templates, and page-view data are not preserved.
- The shared Auth API is the sole identity provider; BlogSite has no users or
  roles UI.
- The dashboard focuses on the previous 30 days: views, unique visitors,
  post-state counts, daily views, and top posts.

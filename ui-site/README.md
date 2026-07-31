This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Public data fetching (ISR)

Public pages (`app/(site)/**`) fetch the API directly — no server actions or
route handlers in between — using `fetch(..., { next: { revalidate: N } })`
for Next.js Incremental Static Regeneration. The intervals live in one place,
`ui-site/lib/api.ts`'s `REVALIDATE_SECONDS`:

| Data                                  | Interval | Used by                                  |
| -------------------------------------- | -------- | ----------------------------------------- |
| Post lists (`GET /api/posts`)          | 60s      | home, category/[slug]                     |
| Post detail (`GET /api/posts/slug/…`)  | 60s      | blog/[slug]                               |
| Categories (`GET /api/categories`)     | 60s      | categories, category/[slug] (slug lookup) |
| Layout templates (`GET /api/layouttemplates/{id}`) | 300s | blog/[slug] rendering             |

A newly published post (or a status change away from Published) becomes
visible to anonymous visitors within at most one revalidation interval (60s
for the list/detail data driving it) — Next.js serves the previous cached
render until the next request after that window triggers a background
regeneration.

The API itself is the source of truth for visibility: anonymous callers are
forced to the Published-only view server-side (issue #33) regardless of any
client-supplied filter, and non-Published posts 404 (not 403) on the detail
routes. The pages here never filter by status client-side — they trust the
server's response and treat a 404 as "not publicly visible," full stop.

### Pageview recording

`POST /api/analytics/pageview` is fire-and-forget and public. Because page
rendering is ISR-cached, recording a pageview *inside* the server component
would only fire once per cache regeneration (roughly once per revalidation
window), drastically undercounting real visits. Instead, every public page
(`home`, `categories`, `category/[slug]`, `blog/[slug]`) mounts
`components/PageViewRecorder.tsx`, a small client component that fires the
record call once per real browser visit, independent of the ISR cache:

- `blog/[slug]` passes the post's `id` so post-level views can be attributed.
- List pages (`home`, `categories`, `category/[slug]`) pass no `postId`
  (recorded as `null`) — list pages don't correspond to a single post, so
  only the visited `path` is recorded.

### Environment variables

| Variable               | Purpose                                   | Default                 |
| ----------------------- | ------------------------------------------ | ------------------------ |
| `NEXT_PUBLIC_API_URL`  | Base URL of the BlogSite API               | `http://localhost:5000` |

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

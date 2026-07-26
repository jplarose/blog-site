This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Set these environment variables for local admin development:

```bash
APP_BASE_URL=http://localhost:3000
DOTNET_APP_BASE_URL=http://localhost:5017
AUTH_API_BASE_URL=http://localhost:5001
AUTH_API_KEY=base64(<clientName>:<clientApiKey>)
```

`AUTH_API_BASE_URL` is the base URL of the shared external Auth API used by the
`/api/auth/*` BFF routes (`ui-admin/lib/auth/auth-api.ts`). `AUTH_API_KEY` is the
pre-encoded `X-Api-Key` value for this client (`base64("<clientName>:<clientApiKey>")`) —
treat it as a secret, never prefix it with `NEXT_PUBLIC_`, and never commit a real
value. Both are read server-side only and are required at request time; requests
fail fast with a clear error if either is unset.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

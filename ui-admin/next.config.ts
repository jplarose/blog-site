import type { NextConfig } from "next";

// All /api/* traffic goes through the app/api route handlers (BFF proxy in
// lib/api-proxy.ts), which attach the session's bearer token server-side.
// Do NOT add a blanket /api rewrite to the .NET backend here: afterFiles
// rewrites take precedence over dynamic app routes, so a catch-all rewrite
// silently bypasses every [id] proxy handler and strips authentication.
const nextConfig: NextConfig = {};

export default nextConfig;

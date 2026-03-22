import type { NextConfig } from "next";

const backendApiBaseUrl =
  process.env.DOTNET_APP_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000";

const nextConfig: NextConfig = {
  // Proxy /api/* requests to the .NET backend during development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendApiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

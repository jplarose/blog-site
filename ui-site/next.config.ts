import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images from any external source (blog post featured images)
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }],
  },
  // Proxy /api/* requests to the .NET backend during development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

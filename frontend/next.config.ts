import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const backendUrl = process.env.KANBAN_BACKEND_URL ?? "http://127.0.0.1:8000";
    return [{ source: "/backend-api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;

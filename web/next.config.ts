import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:5000";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

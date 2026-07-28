import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  // Don't bundle native/adapter packages — load from node_modules at runtime
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client"],
};

export default nextConfig;

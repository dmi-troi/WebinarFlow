import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  // Don't bundle Prisma packages — all must be the same module instance at runtime
  // otherwise the adapter (loaded externally) and PrismaClient (bundled) are
  // different class hierarchies and Prisma ignores the adapter.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Don't bundle these — they'll be provided at runtime via Dockerfile COPY
  serverExternalPackages: [
    '@prisma/adapter-libsql',
    '@libsql/client',
  ],
};

export default nextConfig;

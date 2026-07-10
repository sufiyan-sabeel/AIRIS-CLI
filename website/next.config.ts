import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/AIRIS-CLI",
  assetPrefix: "/AIRIS-CLI/",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  transpilePackages: ["framer-motion"],
  // Prevent Turbopack from going up to monorepo root and including external files
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

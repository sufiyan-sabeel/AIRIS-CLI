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
};

export default nextConfig;

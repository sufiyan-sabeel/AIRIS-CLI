import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/AIRIS-CLI",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  transpilePackages: ["framer-motion"],
  typescript: {
    ignoreBuildErrors: true,
  },
  // webpack config intentionally empty - build uses package.json script
};

export default nextConfig;

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
  // Prevent webpack from merging chunks (RSC payload references specific chunk IDs)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {},
        maxInitialRequests: 25,
        minSize: 20000,
      };
    }
    return config;
  },
};

export default nextConfig;

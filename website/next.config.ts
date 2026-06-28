import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/AIRIS-CLI",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;

#!/usr/bin/env bash
# AIRIS Web — Standalone Deployment Prep
# Usage: bash setup-deploy.sh <target-dir>
# Copies website source from monorepo and prepares for standalone GitHub Pages deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-airis-web-deploy}"

echo "==> Preparing AIRIS Web for standalone deployment"
echo "    Source: $REPO_ROOT/website"
echo "    Target: $TARGET"
echo ""

# Create target
mkdir -p "$TARGET"

# Copy source files (exclude node_modules, .next, out)
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='package-lock.json' \
  "$REPO_ROOT/website/" "$TARGET/"

# Remove old lockfile so it's regenerated for standalone
rm -f "$TARGET/package-lock.json"

# Write root-domain next.config (no basePath/assetPrefix)
cat > "$TARGET/next.config.ts" << 'NEXTCONFIG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  transpilePackages: ["framer-motion"],
};

export default nextConfig;
NEXTCONFIG

# Update layout metadataBase to be dynamic
sed -i "s|metadataBase: new URL.*|metadataBase: new URL(process.env.SITE_URL || 'https://example.github.io/repo'),|" "$TARGET/app/layout.tsx" 2>/dev/null || true

# Write deploy workflow if not present
mkdir -p "$TARGET/.github/workflows"
cat > "$TARGET/.github/workflows/deploy.yml" << 'WORKFLOW'
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.19.0'
          cache: 'npm'
      - run: npm ci --ignore-scripts --no-audit --no-fund
      - uses: actions/configure-pages@v5
        with:
          static_site_generator: next
      - run: npm run build
      - run: touch out/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
WORKFLOW

# Generate fresh package-lock
cd "$TARGET"
npm install --package-lock-only --ignore-scripts --no-audit --no-fund 2>/dev/null || true

echo ""
echo "==> Done! $TARGET is ready for standalone deployment."
echo ""
echo "Next steps:"
echo "  1. Create a new GitHub repo (e.g. airis-web)"
echo "  2. cd $TARGET"
echo "  3. git init && git add . && git commit -m 'Initial deploy'"
echo "  4. git remote add origin https://github.com/<user>/<repo>.git"
echo "  5. git push -u origin main"
echo ""
echo "  The GitHub Actions workflow will auto-deploy to Pages."

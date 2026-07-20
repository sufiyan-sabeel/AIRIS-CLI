# AIRIS-CLI Website

A premium, original product website for **AIRIS-CLI** — the terminal-native AI coding agent.

> Built as a clean-room, original implementation **inspired by the engineering quality** of the
> Magic UI portfolio template. It shares no branding, copy, images, layout, or personal content
> with that reference. All marketing text, the logo mark, screenshots (vector mockups), and copy
> are original and describe the real AIRIS-CLI product.

## Stack

- **Next.js 15** (App Router, static export)
- **React 19** + **TypeScript**
- **Tailwind CSS v3** + **shadcn/ui** primitives (new-york style)
- **Magic UI**-style animations (BlurFade, FlickeringGrid, AnimatedGradientText, ShimmerButton, BorderBeam, TypingAnimation) built with **Framer Motion**
- **next-themes** (dark AMOLED default, blue/cyan accents)
- **PWA** — web manifest + service worker (offline shell)

## Getting started

```bash
npm install --no-audit --no-fund
npm run dev      # http://localhost:3000
npm run build    # static export -> ./out
npm run start    # serve the production build
```

> Note: if your filesystem does not support symlinks (e.g. some Android/FUSE mounts),
> install with `npm install --no-bin-links` and use the `node node_modules/next/dist/bin/next …`
> binaries, or just run `npm run dev/build` (the scripts already point at the local binary).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build + static export to `out/` |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint (skipped during build) |

## Pages

`/` Home · `/features` · `/install` · `/docs` · `/providers` · `/extensions` ·
`/roadmap` · `/blog` (+ `/blog/[slug]`) · `/github` · `404`

Homepage sections: animated hero, live interactive CLI demo + AI reasoning preview,
feature cards, architecture diagram, original vector "screenshots", docs preview, footer CTA.

## Design system

- **Theme:** AMOLED black base (`--background` near `#070a12`), blue primary (`#3b82f6`),
  cyan accent (`#22d3ee`). Toggle in the navbar; respects `prefers-color-scheme` and
  `prefers-reduced-motion`.
- **Glass UI:** `.glass` / `.glass-strong` utilities for premium blurred surfaces.
- **Performance:** fully static export, self-hosted `next/font` (Inter + JetBrains Mono),
  zero raster images (all SVG/vector), `output: export` for tiny Core Web Vitals,
  lazy/in-view animations, and reduced-motion fallbacks.

## Deploying to GitHub Pages

The site is a static export. To deploy under `/AIRIS-CLI/`:

```bash
BASE_PATH=/AIRIS-CLI npm run build
```

Then publish the `out/` directory. Update `siteConfig.url` in `src/lib/site.ts` and the
`metadataBase` so social/SEO URLs resolve correctly. The `manifest.webmanifest` `start_url`
is set to `/`; when using a sub-path, adjust it for installability.

## Project structure

```
src/
  app/                 # routes (layout, pages, not-found, robots, sitemap, icon)
  components/
    ui/                # shadcn/ui primitives (button, card, badge, tabs, accordion, …)
    magicui/           # animation primitives (blur-fade, flickering-grid, …)
    sections/          # homepage sections
    *.tsx              # navbar, footer, terminal-demo, ai-reasoning-preview, …
  lib/
    site.ts            # all site content/data (original copy)
    utils.ts           # cn() helper
public/                # manifest.webmanifest, sw.js, icons
```

## License

Website content and code are provided for the AIRIS-CLI project. AIRIS-CLI itself is MIT licensed.

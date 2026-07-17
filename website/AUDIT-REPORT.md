# AIRIS Installer Website — Full Audit Report

## 1. Architecture Overview

### Framework & Build
- **Framework:** Next.js 16 (next@^16.2.9, stable) with App Router
- **Build:** Static export (`output: "export"`)
- **Deployment:** GitHub Pages (`sufiyan-sabeel.github.io/AIRIS-CLI/`)
- **Styling:** Tailwind CSS 4.1 (`@tailwindcss/postcss`) with CSS custom properties
- **Types:** TypeScript 5.8 with strict mode
- **Linting:** ESLint 9 + eslint-config-next

### Pages (23 routes)
| Route | Type | Purpose | Classification |
|---|---|---|---|
| `/` | Landing | Primary marketing page | B (Improve) |
| `/features` | Marketing | Feature showcase | B (Improve) |
| `/ai-models` | Marketing | Provider list | B (Improve) |
| `/brain` | Marketing | Agent system explainer | C (Redesign) |
| `/workflow` | Marketing | Workflow automation | B (Improve) |
| `/pricing` | Marketing | Pricing plans (aspirational) | B (Improve) |
| `/docs` | Docs | Documentation hub | B (Improve) |
| `/docs/getting-started` | Docs | Quick start | A (Keep) |
| `/docs/providers` | Docs | Provider setup | A (Keep) |
| `/download` | Installer | Installation page | B (Improve) |
| `/ide` | Interactive | Web IDE demo | C (Redesign) |
| `/dashboard` | Static | Project dashboard | B (Improve) |
| `/android-automation` | Marketing | Android features | B (Improve) |
| `/vision-studio` | Marketing | Vision capabilities | B (Improve) |
| `/developer-tools` | Marketing | Dev tools | B (Improve) |
| `/community` | Marketing | Community page | B (Improve) |
| `/roadmap` | Marketing | Project roadmap | B (Improve) |
| `/changelog` | Docs | Version history | A (Keep) |
| `/blog` | Content | Blog listing | B (Improve) |
| `/app` | Dashboard | Dashboard app layout | C (Redesign) |
| `/app/workspace` | Dashboard | AI workspace | C (Redesign) |
| `/app/agents` | Dashboard | Agent management | C (Redesign) |
| `/not-found` | Utility | 404 page | A (Keep) |

### Component Tree

```
layout.tsx (RootLayout)
├── Providers (ThemeProvider)
├── ScrollProgress
├── Skip-to-content link
└── page.tsx
    ├── Header
    │   ├── AirisLogo
    │   ├── Navigation (mainNavItems + dropdown)
    │   ├── ThemeToggle
    │   └── Mobile menu
    ├── Main content sections
    │   ├── Hero
    │   │   ├── ParticleField (canvas)
    │   │   ├── Gradient orbs
    │   │   └── TerminalDemo
    │   ├── Features
    │   │   └── StaggerChildren → TiltCard → FeatureCard
    │   ├── Demo/Video
    │   │   └── VideoProof
    │   ├── Installation
    │   │   └── CodeBlock (3x) + InteractiveTerminal
    │   ├── Quick Start
    │   ├── Workflow
    │   ├── Command Explorer
    │   ├── Termux / Android
    │   ├── AIRIS IDE
    │   ├── Docs / Providers
    │   ├── Creator / Journey
    │   └── Safety
    ├── Footer
    └── ScrollToTop
```

### Component Catalog (22 components)

| Component | Lines | Client | Animations | Purpose |
|---|---|---|---|---|
| `header.tsx` | 120 | Yes | CSS transitions | Navigation with dropdown |
| `footer.tsx` | 95 | No | None | Multi-column footer |
| `providers.tsx` | 8 | Yes | None | Theme provider wrapper |
| `particle-field.tsx` | 135 | Yes | Canvas animation | Particle network background |
| `scroll-reveal.tsx` | 128 | Yes | Framer Motion | 7 reveal variants + stagger |
| `tilt-card.tsx` | 75 | Yes | Framer Motion | 3D tilt on hover |
| `terminal-demo.tsx` | 165 | Yes | Framer Motion | Typewriter terminal effect |
| `interactive-terminal.tsx` | 220 | Yes | Framer Motion | Platform terminal simulator |
| `code-block.tsx` | 32 | No (child is) | None | Styled code with copy |
| `feature-card.tsx` | 40 | No | CSS | Feature article card |
| `section-header.tsx` | 25 | No | None | Section heading pattern |
| `scroll-progress.tsx` | 20 | Yes | Framer Motion | Top progress bar |
| `scroll-to-top.tsx` | 42 | Yes | Framer Motion | Floating button |
| `logo.tsx` | 42 | No | None | SVG logo |
| `mobile-nav.tsx` | 72 | Yes | Framer Motion | Mobile drawer |
| `theme-toggle.tsx` | 16 | Yes | None | Dark/light toggle |
| `copy-button.tsx` | 50 | Yes | CSS toast | Copy with feedback |
| `video-proof.tsx` | 150 | Yes | Framer Motion | Video player + proof cards |
| `changelog.tsx` | 115 | Yes | None | Changelog display |
| `command-explorer.tsx` | 80 | Yes | Framer Motion | Searchable command list |
| `parallax-layer.tsx` | 25 | Yes | Framer Motion | Scroll parallax |
| `data/site.ts` | 270 | No | None | All site content data |

### UI Components (5)
- `ui/button.tsx` — 5 variants, 4 sizes, forwardRef
- `ui/card.tsx` — Card + Header, Title, Description, Content
- `ui/badge.tsx` — Badge with border
- `ui/input.tsx` — Styled input with ring focus

### Dependencies

**Production:**
- `next@16.2.9`, `react@19.0.0`, `react-dom@19.0.0`
- `framer-motion@12.23.0` — animations
- `three@0.170.0`, `@react-three/fiber@8.17.10`, `@react-three/drei@9.117.3` — 3D (unused in actual components)
- `@studio-freight/lenis@1.0.42` — smooth scroll (imported nowhere)
- `next-themes@0.4.6` — dark mode
- `lucide-react@0.468.0` — icons
- `clsx@2.1.1`, `tailwind-merge@3.3.1`, `class-variance-authority@0.7.1` — styling utils
- `@radix-ui/react-slot@1.2.3` — slot pattern (unused)

**Dev:**
- `tailwindcss@4.1.4`, `@tailwindcss/postcss@4.1.4`
- `typescript@5.8.3`
- `eslint@9.25.1`, `eslint-config-next@16.2.9`

## 2. Current UX Issues

### Critical
1. **No interactive 3D** — Three.js/drei installed but zero components use them. The only visual effect is canvas-based particle field.
2. **Lenis unused** — installed as dependency but never imported in any component.
3. **Dashboard is completely static** — data loaded from JSON file at build time, no live data.
4. **Pricing is entirely aspirational** — no payment integration, all prices/features are hardcoded.

### Major
5. **Hero lacks premium feel** — no 3D visualization, no animated brain, no neural network visualization.
6. **Scroll experience is basic** — only fade-in reveals from Framer Motion, no lenis smooth scroll.
7. **Documentation pages are thin** — getting-started and providers are single pages without full doc structure.
8. **IDE page is monolithic** — 1082 lines in one file, hard to maintain.
9. **No search across docs** — docs page has decorative search bar but no functionality.
10. **Particle field is Canvas2D** — not Three.js, looks dated compared to modern 3D particle systems.

### Minor
11. **Duplicate mobile nav logic** — header has inline mobile menu + separate `mobile-nav.tsx` component.
12. **Video file is 5.5MB** — could be further compressed.
13. **60KB trashed video file** in public/proof/ — cleanup needed.
14. **No page transitions** — navigation between pages has no animation.
15. **Footer links to many non-existent pages** — `/docs/cli`, `/docs/sessions`, etc. don't exist.
16. **Gradient text uses old approach** — `background-clip: text` works but could be better.

## 3. Performance Baseline

### Bundle Analysis (estimated)
- Main JS bundle: ~150-200KB (React + Framer Motion + Next.js)
- Three.js deps: ~120KB (installed but unused — wasted bytes)
- Lenis dep: ~8KB (installed but unused)
- Total node_modules: 140+ packages for website alone

### Assets
- Logo: 2KB SVG
- Video: 5.5MB MP4
- Fonts: Inter + JetBrains Mono (variable, preloaded)
- No raster images

### SEO
- ✅ Proper metadata in layout.tsx
- ✅ JSON-LD structured data (SoftwareApplication)
- ✅ sitemap.xml
- ✅ robots.ts
- ✅ Open Graph + Twitter cards
- ✅ Semantic HTML structure
- ⚠️ Only 2 URLs in sitemap (home + dashboard)
- ✅ Canonical URLs

### Accessibility
- ✅ Skip-to-content link
- ✅ aria-labels on interactive elements
- ✅ Role attributes (log, navigation)
- ✅ Focus-visible styles
- ✅ Reduced-motion support in all animated components
- ✅ Keyboard navigation on menus
- ❌ No focus trap in mobile menu
- ❌ Color contrast could be verified
- ❌ No aria-expanded on dropdown menus

## 4. Classification Summary

### A — Keep (no changes needed)
- `/not-found` (404 page)
- `/changelog` (functional)
- `/docs/getting-started` (functional)
- `/docs/providers` (functional)
- `logo.tsx` (well-designed SVG)
- `section-header.tsx` (reusable pattern)
- `copy-button.tsx` (functional with toast)
- `code-block.tsx` (clean component)
- `providers.tsx` (simple wrapper)

### B — Improve (enhance existing)
- `/` — Hero section: add 3D brain/nn visualization
- `/features` — Add interactive animations
- `/ai-models` — Add search/filter
- `/workflow` — Add visual pipeline
- `/pricing` — Connect to real payment flow
- `/download` — Already has InteractiveTerminal, enhance
- `/dashboard` — Add real-time data visualization
- `/docs` — Add real search functionality
- `/community` — Add contribution stats
- `/blog` — Add RSS, categories
- All sub-pages: apply consistent design language
- `header.tsx` — Add active state indicators
- `footer.tsx` — Verify all links exist
- `particle-field.tsx` — Upgrade to Three.js
- `terminal-demo.tsx` — Improve animations
- `scroll-reveal.tsx` — Add more variants
- `tilt-card.tsx` — Maintain, add to more cards

### C — Redesign (rebuild with new approach)
- `/brain` — Replace static cards with interactive 3D brain visualization
- `/ide` — The 1082-line component needs breaking down into smaller pieces
- `/app/*` — Dashboard layout; add real functionality
- Global scroll system — Add Lenis smooth scrolling
- Hero section — Add 3D neural network + particle field

### D — Remove
- `@studio-freight/lenis` — replace with newer approach or Lenis v2
- `@radix-ui/react-slot` — imported but unused
- Trashed video file in public/proof/

## 5. Opportunities

### Visual
1. **3D Brain Visualization** — Interactive 3D brain using Three.js for the hero and brain page
2. **Neural Network Particles** — Three.js particle field connecting to form network patterns
3. **Scroll-based 3D** — Camera movement, 3D scene parallax tied to scroll
4. **Animated Architecture Map** — Interactive system diagram for the architecture page
5. **Live Dashboard Preview** — Animated mock dashboard with real-looking data

### UX
6. **Smooth Scrolling** — Implement Lenis for buttery smooth scroll experience
7. **Page Transitions** — Animate between pages
8. **Interactive Terminal** — The existing interactive-terminal.tsx is already good, enhance it
9. **Search** — Full-text search across documentation
10. **Analytics** — Track page views and engagement

### Technical
11. **Code Splitting** — Dynamic imports for Three.js components to reduce initial bundle
12. **Image Optimization** — next/image since it's currently unoptimized
13. **Bundle Size** — Tree-shake unused three.js modules
14. **ISR/SSR** — Since currently static export, consider hybrid approach
15. **PWA** — Already has manifest, but could improve service worker

## 6. Mobile Responsiveness

Current state:
- ✅ Responsive grid layouts (sm/md/lg breakpoints)
- ✅ Mobile navigation with hamburger menu
- ✅ Touch-friendly button sizes (min 44px)
- ✅ Safe area insets for notched devices
- ✅ PWA manifest with shortcuts
- ⚠️ Particle field has reduced count on mobile
- ⚠️ Terminal demos have smaller font on mobile
- ❌ No mobile-specific 3D fallback
- ❌ 3D effects not tested on mobile GPUs

## 7. Lighthouse Target (current estimate)
Based on code analysis (no actual run):
- Performance: 75-85 (Three.js + Framer Motion bundle impact)
- Accessibility: 85-90 (good structure, some aria gaps)
- Best Practices: 90-95 (static export is clean)
- SEO: 95-100 (comprehensive metadata)

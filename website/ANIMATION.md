# Animation System

## Libraries

| Library       | Purpose                              |
| ------------- | ------------------------------------ |
| **Anime.js**  | SVG path drawing, counters, stagger  |
| **Framer Motion** | Layout animations, page transitions |

Anime.js is lazy-loaded via dynamic `import()` to keep the initial bundle small.

## Animation Inventory

### Logo (AIRISLogo.tsx)

- **SVG path drawing**: `strokeDashoffset` from full length → 0
- **Fade in**: opacity 0 → 1 on base rect
- **Circle pop-in**: scale 0 → 1 with `easeOutBack(1.7)`
- **Glow pulse**: repeating `drop-shadow` filter (when `glow` prop)
- **Float**: CSS `animate-float` keyframe (6s oscillation)

### Hero Section

- **Logo scale-in**: `scale(0.5 → 1)` with `easeOutBack`
- **Heading stagger**: `opacity + translateY` with 120ms stagger
- **Stats pop**: `scale(0.8 → 1)` with 100ms stagger

### Terminal Demo

- **Line reveal**: `opacity + translateY` via Framer Motion `AnimatePresence`
- **Cursor blink**: CSS `caret-blink` keyframe (1.2s)

### Feature Cards

- **Scroll reveal**: `BlurFade` component (opacity + blur + translateY)
- **Hover lift**: CSS `hover:-translate-y-0.5` + border glow

### Dock Navigation

- **Magnification**: Spring physics on icon size via Framer Motion
- **Active indicator**: `layoutId` shared layout animation

### Magic Rings

- **Canvas rotation**: `requestAnimationFrame` loop (paused when off-screen)
- **Dash animation**: `lineDashOffset` cycling

### Install Command

- **Copy feedback**: `Check` icon replaces `Copy` with opacity transition

## Lazy Loading

All Anime.js animations are loaded via:

```ts
const { getAnime } = await import("@/lib/anime-helpers");
const anime = await getAnime();
```

This means the animejs bundle (~15KB gzipped) is only loaded when animations
are needed, not in the initial page load.

## Reduced Motion

Every animation checks `prefers-reduced-motion: reduce`:

```ts
const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
if (prefersReduced) return; // skip animation
```

CSS animations are also disabled via:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

## Performance

- Canvas animations pause when off-screen (IntersectionObserver)
- Low-performance devices detected via `navigator.hardwareConcurrency`
- GPU-accelerated properties: `transform`, `opacity` only
- No layout-triggering properties animated
- `will-change` applied sparingly

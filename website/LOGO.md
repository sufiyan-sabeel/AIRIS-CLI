# AIRIS Logo

## Source

The official AIRIS logo SVG is sourced directly from the repository's
`README.md` reference at `website/public/airis-logo.svg` (recovered from
commit `9ddd5517`).

## Component

The logo is rendered as a React component at:

```
src/components/logo/AIRISLogo.tsx
```

### Props

| Prop       | Type      | Default | Description                          |
| ---------- | --------- | ------- | ------------------------------------ |
| `size`     | `number`  | `40`    | Width/height in px (square SVG)      |
| `animate`  | `boolean` | `true`  | Enable anime.js entrance animation   |
| `glow`     | `boolean` | `false` | Enable pulsing glow after reveal     |
| `float`    | `boolean` | `false` | Enable idle floating animation       |
| `className`| `string`  | —       | Additional CSS classes               |

### Animation Details

The logo uses **Anime.js** (lazy-loaded) for the following effects:

1. **SVG path drawing** — strokeDashoffset animated from full length to 0
2. **Fade in** — opacity 0 → 1 on the base rectangle
3. **Circle pop-in** — scale 0 → 1 with `easeOutBack` on intelligence nodes
4. **Glow pulse** — repeating drop-shadow filter animation (when `glow` is true)
5. **Smooth rotation** — CSS `animate-float` keyframe (when `float` is true)
6. **Hover morph** — scale transform on parent `:hover`
7. **Idle floating** — 6s ease-in-out vertical oscillation

### Reduced Motion

All animations respect `prefers-reduced-motion: reduce`. When active, the
animation is skipped entirely and the logo renders immediately.

### Usage

```tsx
import AIRISLogo from "@/components/logo/AIRISLogo";

// Simple logo
<AIRISLogo size={32} />

// Animated with glow
<AIRISLogo size={72} glow float />

// Static (no animation)
<AIRISLogo size={32} animate={false} />
```

### Locations

The logo appears in:

- **Navbar** — `size={32}`, static
- **Hero** — `size={80}`, animated with glow + float
- **Footer** — `size={32}`, static
- **Loading Screen** — `size={72}`, animated with glow
- **404 Page** — `size={72}`, with glow
- **PWA Manifest** — referenced via `public/icon.svg`
- **Favicon** — `src/app/icon.svg` (derived from the same SVG)

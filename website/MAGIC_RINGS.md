# Magic Rings

## Overview

A decorative animated background of concentric rotating rings. Used in
the hero section and AI reasoning section to create a premium,
tech-forward aesthetic.

## Component

```
src/components/magic-rings.tsx
```

## Implementation

Canvas-based (no Three.js dependency). Uses `requestAnimationFrame` for
smooth 60fps rendering.

### Props

| Prop           | Type       | Default         | Description                    |
| -------------- | ---------- | --------------- | ------------------------------ |
| `ringCount`    | `number`   | `6`             | Number of concentric rings     |
| `speed`        | `number`   | `0.3`           | Rotation speed multiplier      |
| `darkColors`   | `string[]` | Blue/Cyan/Purple| Colors for dark mode           |
| `lightColors`  | `string[]` | Blue/Indigo/Gray| Colors for light mode          |

### Theme-Aware Colors

Colors adapt to the current theme via `next-themes`:

**Dark Mode:**
- Deep blue (`rgba(96,165,250,0.35)`)
- Cyan (`rgba(34,211,238,0.3)`)
- Purple (`rgba(124,58,237,0.25)`)

**Light Mode:**
- Blue (`rgba(59,130,246,0.25)`)
- Indigo (`rgba(99,102,241,0.2)`)
- Slate (`rgba(148,163,184,0.15)`)

### Performance Optimizations

1. **Off-screen pause**: IntersectionObserver pauses rendering when
   the canvas is not visible
2. **Low-device detection**: Checks `navigator.hardwareConcurrency < 4`
   and disables on weak devices
3. **DPR capping**: Device pixel ratio capped at 2 to prevent GPU
   overload on Retina displays
4. **ResizeObserver**: Only redraws when container size changes

### Reduced Motion

When `prefers-reduced-motion: reduce` is active, the animation pauses
and the rings render statically.

## Usage

```tsx
import MagicRings from "@/components/magic-rings";

// In hero section
<div className="relative overflow-hidden">
  <MagicRings className="absolute inset-0 z-0" />
  {/* content */}
</div>

// Custom config
<MagicRings
  ringCount={8}
  speed={0.4}
  darkColors={["rgba(96,165,250,0.3)", "rgba(34,211,238,0.25)"]}
/>
```

## Rendering

Each ring is drawn as a dashed circle with rotating `lineDashOffset`.
An inner glow ring (wider, lower opacity) is drawn behind each ring
for depth.

```ts
// Per ring:
ctx.arc(cx, cy, radius, 0, Math * 2);
ctx.setLineDash([dashLen, dashLen * 0.6]);
ctx.lineDashOffset = time * speed * 60;
ctx.stroke();
```

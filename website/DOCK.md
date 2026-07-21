# Dock Navigation

## Overview

A macOS-style magnification dock at the bottom of the screen. Icons grow
when the cursor approaches, providing a premium navigation experience.

## Component

```
src/components/dock.tsx
```

## Tabs

| Tab           | Route            | Icon            |
| ------------- | ---------------- | --------------- |
| Home          | `/`              | HomeIcon (SVG)  |
| Features      | `/features`      | FeaturesIcon    |
| Documentation | `/docs`          | DocsIcon        |
| Install       | `/install`       | InstallIcon     |
| GitHub        | External link    | GitHubIcon      |

All icons are hand-drawn SVG (no emojis, no icon library dependency for
the dock itself).

## Magnification

Uses Framer Motion spring physics:

```ts
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };
const MAGNIFICATION = 52;  // max icon size
const DISTANCE = 120;      // influence radius
```

The mouse X position is tracked via `useMotionValue`. Each icon's size
is computed from its distance to the cursor using `useTransform`.

## Mobile

On mobile (touch devices):

- The dock remains visible at the bottom
- Touch interactions work (no magnification on touch)
- Icons are tappable with proper hit targets (42px minimum)

## Accessibility

- Each link has `aria-label`
- Keyboard navigation works (Tab through links)
- Focus ring visible on keyboard focus
- Active route highlighted with `primary/20` background

## Integration

The dock is rendered in the layout as a fixed element:

```tsx
<div className="fixed inset-x-0 bottom-4 z-50 pointer-events-none">
  <Dock>
    {/* tabs */}
  </Dock>
</div>
```

The `pointer-events-none` on the container allows clicks to pass through
to content behind the dock. The dock itself uses `pointer-events-auto`.

## Customization

To add a new tab:

```tsx
const tabs = [
  // ... existing tabs
  { href: "/new", label: "New", icon: NewIcon },
];
```

Create an SVG icon component following the pattern:

```tsx
function NewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className={className}>
      {/* paths */}
    </svg>
  );
}
```

# Theme System

## Architecture

The theme system uses **next-themes** with CSS custom properties and
Tailwind's `dark:` variant.

### Three Themes

| Theme    | Class applied | CSS variable set |
| -------- | ------------- | ---------------- |
| Light    | *(none)*      | `:root`          |
| Dark     | `.dark`       | `.dark`          |
| System   | `.dark` or `*`| follows OS       |

### CSS Variables

All colors are defined as HSL values in `src/app/globals.css`:

```css
:root {
  --background: 210 40% 98%;     /* light background */
  --foreground: 222 47% 11%;     /* light text */
  --primary: 217 91% 55%;        /* blue */
  --accent: 187 92% 50%;         /* cyan */
  /* ... */
}

.dark {
  --background: 225 30% 4%;      /* AMOLED dark */
  --foreground: 210 40% 96%;     /* dark text */
  --primary: 217 91% 60%;        /* brighter blue */
  --accent: 187 92% 50%;         /* same cyan */
  /* ... */
}
```

### Tailwind Integration

In `tailwind.config.ts`, colors reference the CSS variables:

```ts
colors: {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  // ...
}
```

### Glass Surfaces

Custom utilities in `globals.css` provide frosted-glass effects:

```css
.glass {
  background: hsl(var(--card) / 0.6);
  backdrop-filter: blur(16px) saturate(160%);
}
```

### Theme Toggle

The toggle component (`src/components/theme-toggle.tsx`) provides:

- **Desktop**: dropdown panel in the navbar
- **Mobile**: same dropdown (works on touch)
- **SVG icons only**: Sun, Moon, Monitor (no emojis)
- **System detection**: respects OS preference
- **LocalStorage persistence**: via next-themes
- **Zero hydration mismatch**: mounted guard prevents flash

### Default Theme

The default is `"system"` — the site follows the user's OS preference.
This is configured in `layout.tsx`:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
```

### Smooth Transition

`disableTransitionOnChange` prevents flash of unstyled content during
theme switches. The transition is handled by CSS `transition-colors` on
individual elements.

### Accessibility

- All color contrasts meet WCAG AA (4.5:1 for text, 3:1 for large text)
- Focus rings use `ring` color which adapts to theme
- `prefers-reduced-motion` disables all animations

# Social Preview Design

## Specifications

- **Dimensions:** 1280 x 640 pixels
- **Format:** PNG
- **Filename:** `social-preview.png`

## Design Elements

### Background
- Dark graphite background (#1a1a2e or similar dark color)
- Subtle gradient from dark blue-black to dark purple-black

### Center: AIRIS Emblem
- Orange AIRIS text/logo (#ff6b00 or similar vibrant orange)
- Clean, bold typography
- Optional: subtle glow effect behind the emblem

### Text
- **Title:** "AIRIS" in large bold white text
- **Subtitle:** "AI Coding Agent for Your Terminal" in lighter gray
- **Version:** "v0.80" in small orange text (update per release)

### Layout
```
+--------------------------------------------------+
|                                                  |
|                                                  |
|              [AIRIS EMBLEM]                      |
|                                                  |
|                  AIRIS                           |
|    AI Coding Agent for Your Terminal             |
|                                                  |
|              v0.80  |  MIT License               |
|                                                  |
+--------------------------------------------------+
```

## Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Background | Dark charcoal | #1a1a2e |
| AIRIS text | Vibrant orange | #ff6b35 |
| Subtitle | Light gray | #a0a0a0 |
| Version | Orange accent | #ff6b35 |
| Border | Subtle orange | #ff6b3533 |

## Tools for Creation

- Figma (free tier)
- Canva
- ImageMagick (command line)
- Sharp (Node.js)

## Example ImageMagick Command

```bash
convert -size 1280x640 xc:'#1a1a2e' \
  -fill '#ff6b35' -font Helvetica-Bold -pointsize 120 -gravity center -annotate +0-80 'AIRIS' \
  -fill '#a0a0a0' -font Helvetica -pointsize 36 -gravity center -annotate +0+20 'AI Coding Agent for Your Terminal' \
  -fill '#ff6b35' -font Helvetica -pointsize 28 -gravity center -annotate +0+80 'v0.80  |  MIT License' \
  social-preview.png
```

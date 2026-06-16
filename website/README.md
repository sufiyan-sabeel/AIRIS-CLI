# AIRIS CLI – Website

Professional product website for [AIRIS CLI](https://github.com/sufiyan-sabeel/AIRIS-CLI).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main landing page with 10 sections |
| `style.css` | Graphite/slate dark theme stylesheet |
| `script.js` | Interactive functionality, tabs, copy, animations |
| `install.sh` | One-command curl installer (no git clone) |
| `netlify.toml` | Netlify deployment configuration |
| `README.md` | This file |

## Website Sections

1. **Hero** – Brand, tagline, CTA
2. **Install** – Tabbed install commands (curl, npm, pnpm, bun)
3. **CLI Preview** – Interactive terminal demo with animation
4. **Features** – 8 feature cards
5. **Commands** – Complete command reference
6. **Sessions** – Resume, fork, export workflow cards
7. **Android/Termux** – Mobile installation guide
8. **Creator Profile** – Brand KageOS, creator Umaiz Sufiyan
9. **Roadmap** – Version timeline with current status
10. **FAQ** – Collapsible Q&A

## Local Development

```bash
cd /root/AIRIS-CLI/website
python3 -m http.server 8080
```

Open http://localhost:8080 in a browser.

## Installer Test

```bash
bash -n install.sh
```

## Netlify Deployment

```bash
npm install -g netlify-cli
netlify login
cd /root/AIRIS-CLI/website
netlify init
netlify deploy --prod
```

## Install Command

```bash
curl -fsSL https://airis-cli.netlify.app/install.sh | sh
```

## Installer Behavior

- Does **not** git clone
- Checks OS, shell, Node.js, npm
- Installs via `npm install -g --ignore-scripts @earendil-works/airis-coding-agent`
- If npm package is not published, prints clear message and exits cleanly
- Verifies installation with `airis --help`
- Professional spinner/progress animation

## Branding

- **Product**: AIRIS CLI
- **Full form**: Artificial Intelligence Responsive Integrated System
- **Brand**: KageOS
- **Creator**: Umaiz Sufiyan
- **Version**: 0.79.3
- **License**: MIT

# AIRIS Web Platform

The marketing website, AI Operating System dashboard, and Web IDE for [AIRIS-CLI](https://github.com/sufiyan-sabeel/AIRIS-CLI).

## Pages

- **Home** — Hero, features, install, demo, community
- **Features** — All AIRIS capabilities
- **AI Models** — 20+ provider ecosystem
- **Brain & Agents** — Agent creation studio
- **Workflow Automation** — Visual workflow builder
- **Android Automation** — ADB & device control
- **Vision Studio** — Image gen, OCR, visual reasoning
- **Developer Tools** — Code editor, terminal, git
- **Pricing** — Free, Pro, Team, Enterprise
- **Community** — Open source & contribute
- **Download** — All install methods
- **Roadmap** — Vision & development plan
- **Blog** — Updates & articles
- **Changelog** — Release history
- **Docs** — Documentation portal
- **Dashboard** — AI workspace, agents, analytics
- **Web IDE** — Monaco editor, AI chat, terminal, debugger

## Tech Stack

- **Framework**: Next.js 16 (static export)
- **Styling**: Tailwind CSS 4 + CSS custom properties
- **UI**: Lucide icons, Radix UI slot, Framer Motion
- **Deploy**: GitHub Pages (via Actions)

## Quick Start

```bash
npm install --ignore-scripts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build for Production

```bash
npm run build
```

Static output goes to `out/` — ready for any static host.

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to repo **Settings > Pages**
3. Source: **GitHub Actions**
4. Push to `main` — the workflow in `.github/workflows/deploy.yml` auto-deploys

The site will be at `https://<your-username>.github.io/<repo-name>/`

## Source

This is a standalone deployment of the AIRIS website. The source lives in the [AIRIS-CLI monorepo](https://github.com/sufiyan-sabeel/AIRIS-CLI/tree/main/website).

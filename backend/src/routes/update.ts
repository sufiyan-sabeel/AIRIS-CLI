import { Router } from 'express';

const router = Router();

const currentVersion = {
  version: '0.79.8',
  buildDate: '2026-07-13',
  channel: 'stable',
  nodeRequired: '>=22.19.0',
  packages: {
    cli: '0.79.8',
    ai: '0.79.8',
    agent: '0.79.8',
    tui: '0.79.8',
  },
};

const changelog = [
  {
    version: '0.79.8',
    date: '2026-07-13',
    type: 'release',
    title: 'Web Platform Launch',
    changes: [
      { type: 'added', description: 'Multi-page marketing website with 14+ landing pages' },
      { type: 'added', description: 'AI Operating System Dashboard with workspace management' },
      { type: 'added', description: 'AIRIS Web IDE with Monaco editor, chat, file tree, and terminal' },
      { type: 'added', description: 'PWA support for mobile installation' },
      { type: 'added', description: 'Self-update system with changelog tracking' },
      { type: 'added', description: 'Documentation portal with quick start, CLI ref, and provider guides' },
      { type: 'added', description: 'Authentication system with multiple provider support' },
      { type: 'changed', description: 'Upgraded marketing design to Apple-level premium aesthetic' },
      { type: 'changed', description: 'Expanded AI provider support to 20+ providers' },
    ],
  },
  {
    version: '0.79.0',
    date: '2026-07-01',
    type: 'release',
    title: 'Agent System & Workflow Automation',
    changes: [
      { type: 'added', description: 'Multi-agent orchestration system' },
      { type: 'added', description: 'Visual workflow builder (alpha)' },
      { type: 'added', description: 'Agent memory persistence' },
      { type: 'added', description: 'Workflow templates library' },
      { type: 'changed', description: 'Improved session management performance' },
    ],
  },
  {
    version: '0.78.0',
    date: '2026-06-15',
    type: 'release',
    title: 'Mobile & Android Enhancements',
    changes: [
      { type: 'added', description: 'ADB device control integration' },
      { type: 'added', description: 'Termux API support for Android notifications, TTS, clipboard' },
      { type: 'added', description: 'Voice assistant mode' },
      { type: 'fixed', description: 'Termux file system path resolution' },
    ],
  },
  {
    version: '0.77.0',
    date: '2026-06-01',
    type: 'release',
    title: 'Provider Ecosystem Expansion',
    changes: [
      { type: 'added', description: 'DeepSeek V3 and R1 provider support' },
      { type: 'added', description: 'xAI Grok integration' },
      { type: 'added', description: 'Cerebras CS-3 support' },
      { type: 'added', description: 'NVIDIA NIM integration' },
      { type: 'changed', description: 'Optimized provider routing for cost efficiency' },
    ],
  },
  {
    version: '0.76.0',
    date: '2026-05-15',
    type: 'release',
    title: 'Verified Autonomy & Safety',
    changes: [
      { type: 'added', description: 'Mission contracts and capability leases' },
      { type: 'added', description: 'Evidence reporting system' },
      { type: 'added', description: 'Failure genome search' },
      { type: 'added', description: 'Project trust controls' },
      { type: 'changed', description: 'Enhanced permission model for tool execution' },
    ],
  },
];

// Get current version info
router.get('/version', (_req, res) => {
  res.json(currentVersion);
});

// Get full changelog
router.get('/changelog', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 0;
  const result = limit > 0 ? changelog.slice(0, limit) : changelog;
  res.json({ changelog: result, total: changelog.length });
});

// Get latest changelog entry
router.get('/latest', (_req, res) => {
  res.json(changelog[0] || null);
});

// Check for updates
router.get('/check', (_req, res) => {
  res.json({
    current: currentVersion.version,
    latest: currentVersion.version,
    upToDate: true,
    updateAvailable: false,
    channel: currentVersion.channel,
    lastChecked: new Date().toISOString(),
  });
});

// Get daily facts (for dashboard)
const dailyFacts = [
  "AIRIS supports 20+ AI providers — more than any other AI platform.",
  "AIRIS can run entirely on your Android device via Termux.",
  "The `airis ship` workflow automates the full development lifecycle.",
  "AIRIS uses a multi-layer memory system: episodic, semantic, and procedural.",
  "You can create custom AIRIS extensions in TypeScript.",
  "AIRIS supports local models via Ollama — no cloud needed.",
  "The AIRIS Web IDE is a PWA that works offline on mobile.",
  "AIRIS started as a project by a 16-year-old developer.",
  "AIRIS Brain orchestrates multiple AI agents working in parallel.",
  "The `airis` command has over 40 built-in commands and options.",
];

router.get('/daily-fact', (_req, res) => {
  const today = new Date();
  const index = today.getDate() % dailyFacts.length;
  res.json({
    fact: dailyFacts[index],
    index,
    total: dailyFacts.length,
    date: today.toISOString().split('T')[0],
  });
});

export default router;
export { currentVersion, changelog };

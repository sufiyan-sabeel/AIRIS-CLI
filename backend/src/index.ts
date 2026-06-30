import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat';
import cliRoutes from './routes/cli';
import taskRoutes from './routes/tasks';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import { initDatabase, closeDatabase, saveToDisk } from './config/database';
import { isFirebaseInitialized } from './config/firebase';
import { MemoryService } from './services/memoryService';

async function main(): Promise<void> {
  await initDatabase();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  const corsOrigins = process.env.CORS_ORIGINS || '*';
  app.use(cors({
    origin: corsOrigins === '*' ? true : corsOrigins.split(',').map(s => s.trim()),
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      firebase: isFirebaseInitialized() ? 'configured' : 'dev-mode',
      providers: {
        openai: !!process.env.OPENAI_AAIRIS_KEY && process.env.OPENAI_AAIRIS_KEY !== 'sk-your-openai-key',
        gemini: !!process.env.GEMINI_AAIRIS_KEY && process.env.GEMINI_AAIRIS_KEY !== 'your-gemini-key',
        grok: !!process.env.GROK_AAIRIS_KEY && process.env.GROK_AAIRIS_KEY !== 'xai-your-grok-key',
        openrouter: !!process.env.OPENROUTER_AAIRIS_KEY && process.env.OPENROUTER_AAIRIS_KEY !== 'sk-or-your-openrouter-key'
      }
    });
  });

  app.use('/api/chat', chatRoutes);
  app.use('/api/cli', cliRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/system', systemRoutes);

  app.get('/api/history', (req, res) => {
    try {
      const uid = (req.query.uid as string) || 'anonymous';
      const limit = parseInt(req.query.limit as string) || 50;
      const history = MemoryService.getRecentHistory(uid, limit);
      res.json({ history });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error });
    }
  });

  app.get('/api/memory', (req, res) => {
    try {
      const uid = (req.query.uid as string) || 'anonymous';
      const memories = MemoryService.getAllMemories(uid);
      res.json({ memories });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] AIRIS Backend running on port ${PORT}`);
    console.log(`[Server] Health: http://localhost:${PORT}/health`);
    console.log(`[Server] System: http://localhost:${PORT}/api/system/health`);
    console.log(`[Server] Firebase: ${isFirebaseInitialized() ? 'configured' : 'dev-mode'}`);
    console.log(`[Server] Providers:`, {
      openai: !!process.env.OPENAI_AAIRIS_KEY && process.env.OPENAI_AAIRIS_KEY !== 'sk-your-openai-key',
      gemini: !!process.env.GEMINI_AAIRIS_KEY && process.env.GEMINI_AAIRIS_KEY !== 'your-gemini-key',
      grok: !!process.env.GROK_AAIRIS_KEY && process.env.GROK_AAIRIS_KEY !== 'xai-your-grok-key',
      openrouter: !!process.env.OPENROUTER_AAIRIS_KEY && process.env.OPENROUTER_AAIRIS_KEY !== 'sk-or-your-openrouter-key'
    });
  });

  function gracefulShutdown(signal: string): void {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    saveToDisk();
    closeDatabase();
    process.exit(0);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});

export default main;

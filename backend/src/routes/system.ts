import { Router, Request, Response, NextFunction } from 'express';
import { closeDatabase, saveToDisk } from '../config/database';

const router = Router();

function restrictToLocalhost(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '';

  if (!isLocal) {
    res.status(403).json({ error: 'This endpoint is only accessible from localhost' });
    return;
  }

  next();
}

router.get('/health', restrictToLocalhost, (_req: Request, res: Response) => {
  const mem = process.memoryUsage();

  res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024)
    },
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform
  });
});

router.post('/shutdown', restrictToLocalhost, (_req: Request, res: Response) => {
  console.log('[System] Shutdown requested');

  res.json({ status: 'shutting_down', message: 'Server is shutting down gracefully' });

  setTimeout(() => {
    console.log('[System] Saving database...');
    saveToDisk();
    closeDatabase();
    console.log('[System] Shutting down...');
    process.exit(0);
  }, 500);
});

export default router;

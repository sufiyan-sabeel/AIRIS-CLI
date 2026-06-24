import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { MemoryService } from '../services/memoryService';

const router = Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const tasks = MemoryService.getTasks(authReq.user!.uid, limit);
    res.json({ tasks });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Tasks] Error:', error);
    res.status(500).json({ error });
  }
});

router.post('/', authMiddleware, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const { name, command } = req.body as { name: string; command: string };

    if (!name || !command) {
      res.status(400).json({ error: 'Name and command are required' });
      return;
    }

    const task = MemoryService.createTask(authReq.user!.uid, name, command);
    res.json({ task });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Tasks] Create error:', error);
    res.status(500).json({ error });
  }
});

router.get('/pending', authMiddleware, (_req: Request, res: Response) => {
  try {
    const tasks = MemoryService.getPendingTasks();
    res.json({ tasks });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Tasks] Pending error:', error);
    res.status(500).json({ error });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { executeCliCommand } from '../services/cliService';

const router = Router();

router.post('/execute', authMiddleware, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { command, workDir } = req.body as { command: string; workDir?: string };

  if (!command || typeof command !== 'string') {
    res.status(400).json({ error: 'Command is required' });
    return;
  }

  executeCliCommand(command, workDir, authReq.user!.uid, res);
});

export default router;

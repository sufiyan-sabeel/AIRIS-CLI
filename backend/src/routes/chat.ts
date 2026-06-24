import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { streamChat, chatNonStream } from '../services/aiService';

const router = Router();

router.post('/stream', authMiddleware, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { message, provider, sessionId } = req.body as {
    message: string;
    provider?: string;
    sessionId?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const activeProvider = provider || 'openai';
  const session = sessionId || `session_${Date.now()}`;

  streamChat(activeProvider, authReq.user!.uid, message.trim(), session, res);
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const { message, provider, sessionId } = req.body as {
      message: string;
      provider?: string;
      sessionId?: string;
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const activeProvider = provider || 'openai';
    const session = sessionId || `session_${Date.now()}`;

    const result = await chatNonStream(activeProvider, authReq.user!.uid, message.trim(), session);
    res.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Chat] Error:', error);
    res.status(500).json({ error });
  }
});

export default router;

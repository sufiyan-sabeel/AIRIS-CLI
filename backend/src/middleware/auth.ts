import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../config/firebase';
import { queryOne, run } from '../config/database';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  dbUser?: any;
}

function getOrCreateUser(uid: string, email: string, displayName: string): any {
  run(
    `INSERT INTO users (uid, email, display_name, last_login)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(uid) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       last_login = datetime('now')`,
    [uid, email, displayName]
  );
  return queryOne('SELECT * FROM users WHERE uid = ?', [uid]);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken) {
    res.status(401).json({ error: 'Empty token' });
    return;
  }

  verifyFirebaseToken(idToken)
    .then((decoded) => {
      const authReq = req as AuthenticatedRequest;
      authReq.user = {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || ''
      };
      authReq.dbUser = getOrCreateUser(authReq.user.uid, authReq.user.email, authReq.user.name);
      next();
    })
    .catch((err: Error) => {
      console.error('[Auth] Token verification failed:', err.message);
      res.status(401).json({ error: 'Invalid or expired token' });
    });
}

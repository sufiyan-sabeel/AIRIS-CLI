let firebaseAvailable = false;
let adminModule: any = null;

async function initFirebase(): Promise<void> {
  if (firebaseAvailable) return;

  try {
    // @ts-ignore - optional dependency, may not be installed
    const mod = await import('firebase-admin');
    adminModule = mod.default || mod;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      adminModule.initializeApp({
        credential: adminModule.credential.cert({ projectId, clientEmail, privateKey })
      });
      firebaseAvailable = true;
      console.log('[Firebase] Admin SDK initialized');
    } else {
      console.warn('[Firebase] Credentials not configured. Using dev mode.');
    }
  } catch {
    console.warn('[Firebase] firebase-admin not installed. Using dev mode.');
  }
}

export function isFirebaseInitialized(): boolean {
  return firebaseAvailable;
}

export async function ensureFirebase(): Promise<void> {
  if (!firebaseAvailable) {
    await initFirebase();
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string; name?: string }> {
  await ensureFirebase();

  if (!firebaseAvailable || !adminModule) {
    return {
      uid: idToken.substring(0, 20),
      email: 'dev@airis.local',
      name: 'Developer'
    };
  }

  const decoded = await adminModule.auth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name || decoded.email?.split('@')[0]
  };
}

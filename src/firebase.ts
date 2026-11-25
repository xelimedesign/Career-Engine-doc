import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
] as const;

const firestoreDatabaseId = (
  firebaseConfig as { firestoreDatabaseId?: string }
).firestoreDatabaseId;

export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
GOOGLE_WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

export function formatFirebaseAuthError(err: unknown): string | null {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return null;
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not authorized in Firebase Authentication. Add it under Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked by your browser. Allow popups for this site and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is disabled in Firebase Console → Authentication → Sign-in method.';
  }
  if (code) {
    return `Sign-in failed (${code}). Check Firebase Authorized Domains and Google Cloud OAuth Consent Screen settings.`;
  }
  return 'Sign-in failed. Please try again.';
}

// Strict in-memory Google Workspace OAuth access token cache (never stored in Web Storage)
let cachedDriveAccessToken: string | null = null;
const driveTokenListeners = new Set<(connected: boolean) => void>();

function notifyDriveTokenListeners() {
  const connected = Boolean(cachedDriveAccessToken);
  driveTokenListeners.forEach((listener) => {
    try {
      listener(connected);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function getDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function hasDriveAccessToken(): boolean {
  return Boolean(cachedDriveAccessToken);
}

export function setDriveAccessToken(token: string | null): void {
  cachedDriveAccessToken = token && token.trim() ? token.trim() : null;
  notifyDriveTokenListeners();
}

export function clearDriveAccessToken(): void {
  if (cachedDriveAccessToken !== null) {
    cachedDriveAccessToken = null;
    notifyDriveTokenListeners();
  }
}

export function subscribeDriveTokenState(listener: (connected: boolean) => void): () => void {
  driveTokenListeners.add(listener);
  return () => {
    driveTokenListeners.delete(listener);
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

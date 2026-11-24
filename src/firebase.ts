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
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
GOOGLE_WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

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

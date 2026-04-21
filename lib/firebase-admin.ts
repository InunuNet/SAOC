import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';

let adminApp: App;

export function initAdmin(): App {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.'
    );
  }

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return adminApp;
}

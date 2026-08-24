import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import {
  OZOW_SANDBOX_TEST_MODE_COLLECTION,
  OZOW_SANDBOX_TEST_MODE_DOC_ID,
} from '@/lib/ozow-sandbox-test-mode-shared';

/**
 * Mission ozow-sandbox-toggle F1. See contracts/golden/ozow-sandbox-toggle-f1/README.md for the
 * full decision record. Storage: a single Firestore doc at
 * `adminSettings/ozowSandboxTestMode`, `{ enabled: boolean, updatedAt, updatedByEmail }`.
 * Server-only: the pure/constant exports live in ./ozow-sandbox-test-mode-shared (README §3d)
 * and are re-exported below so existing server-side importers need no path change.
 */
export * from './ozow-sandbox-test-mode-shared';

/**
 * Reads `adminSettings/ozowSandboxTestMode`, fail-closed. Returns `true` only when the doc
 * exists AND `enabled` is the literal boolean `true` — every other outcome (missing doc,
 * missing field, non-boolean value, a thrown read error) returns `false`. Never throws; a
 * caller must not need its own try/catch to stay fail-closed. `db` is deps-injectable for
 * offline testing (see contracts/checks/ozow-sandbox-toggle-f1/check-fail-closed-flag-read.mjs);
 * production callers omit it and get a real Firestore instance.
 */
export async function isOzowSandboxTestModeEnabled(deps?: {
  db?: Pick<Firestore, 'collection'>;
}): Promise<boolean> {
  try {
    const db = deps?.db ?? getFirestore(initAdmin());
    const snapshot = await db
      .collection(OZOW_SANDBOX_TEST_MODE_COLLECTION)
      .doc(OZOW_SANDBOX_TEST_MODE_DOC_ID)
      .get();
    if (!snapshot.exists) return false;
    const data = snapshot.data();
    return data?.enabled === true;
  } catch {
    return false;
  }
}

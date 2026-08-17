import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import {
  CHECKIN_ATTEMPTS_COLLECTION,
  type AppendOnlyCheckinAttemptsStore,
  type CheckinAttemptRecord,
} from '@/lib/checkin-audit';

/**
 * F7 (ticketing-foundation) — the ONLY Firestore-touching code this feature introduces. Kept
 * tiny and in one file, per the golden README ("What this contract does NOT prove" (2)), so a
 * source-level read at implementation time is enough to confirm it: this calls `.add()` and
 * nothing else, ever. `.add()` always creates a brand-new document with an auto-generated ID —
 * there is no ID here to `.doc(id).set()`/`.update()`/`.delete()` against, so the append-only
 * guarantee holds structurally, not just by convention.
 */
export function createFirestoreCheckinAttemptsStore(): AppendOnlyCheckinAttemptsStore {
  return {
    async addCheckinAttempt(record: CheckinAttemptRecord): Promise<{ id: string }> {
      const db = getFirestore(initAdmin());
      const ref = await db.collection(CHECKIN_ATTEMPTS_COLLECTION).add(record);
      return { id: ref.id };
    },
  };
}

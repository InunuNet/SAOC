import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';

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
    return await readOzowSandboxTestMode(deps?.db);
  } catch {
    return false;
  }
}

/** The raw read. A Firestore failure throws, so a caching wrapper never stores it as `false`. */
async function readOzowSandboxTestMode(db?: Pick<Firestore, 'collection'>): Promise<boolean> {
  const firestore = db ?? getFirestore(initAdmin());
  const snapshot = await firestore
    .collection(OZOW_SANDBOX_TEST_MODE_COLLECTION)
    .doc(OZOW_SANDBOX_TEST_MODE_DOC_ID)
    .get();
  if (!snapshot.exists) return false;
  return snapshot.data()?.enabled === true;
}

/**
 * DISPLAY ONLY. The public checkout banner polls this flag on every page view, so that read goes
 * through a short tagged cache (one Firestore read per OZOW_SANDBOX_BANNER_REVALIDATE_SECONDS per
 * server instance). The admin PUT route calls revalidateTag(OZOW_SANDBOX_BANNER_CACHE_TAG), which
 * clears only the instance that handled the PUT; the other instance (apphosting.yaml allows two,
 * with no shared cache handler) can show the old state for up to the 60 s revalidate window.
 * Never use this to decide sandbox vs live: checkout, the vendor stand payment and the admin
 * screens all call isOzowSandboxTestModeEnabled() directly, uncached.
 *
 * The function inside the cache throws on a read failure, so a failed read is never stored; the
 * catch that maps it to the fail-closed `false` sits outside the cache.
 */
export const OZOW_SANDBOX_BANNER_CACHE_TAG = 'ozow-sandbox-banner';
export const OZOW_SANDBOX_BANNER_REVALIDATE_SECONDS = 60;

const readBannerFlagCached = unstable_cache(
  () => readOzowSandboxTestMode(),
  [OZOW_SANDBOX_BANNER_CACHE_TAG],
  { revalidate: OZOW_SANDBOX_BANNER_REVALIDATE_SECONDS, tags: [OZOW_SANDBOX_BANNER_CACHE_TAG] },
);

export async function getCachedOzowSandboxTestModeForDisplay(): Promise<boolean> {
  try {
    return await readBannerFlagCached();
  } catch {
    return false;
  }
}

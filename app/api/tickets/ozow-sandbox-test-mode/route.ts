import { NextResponse } from 'next/server';

import { isOzowSandboxTestModeEnabled } from '@/lib/ozow-sandbox-test-mode';

/**
 * GET /api/tickets/ozow-sandbox-test-mode -- PUBLIC, unauthenticated status endpoint the
 * checkout page polls to decide whether to render the TEST MODE banner (mission
 * ozow-sandbox-toggle F1). Deliberately not admin-gated: the flag's state is not a secret, only
 * the ability to change it is privileged. Always resolves 200; a Firestore read failure inside
 * isOzowSandboxTestModeEnabled() already fails closed to `false`, so this route never surfaces
 * an error to a buyer mid-checkout. See contracts/golden/ozow-sandbox-toggle-f1/README.md §4.
 */
export async function GET(): Promise<NextResponse> {
  const enabled = await isOzowSandboxTestModeEnabled();
  return NextResponse.json({ enabled });
}

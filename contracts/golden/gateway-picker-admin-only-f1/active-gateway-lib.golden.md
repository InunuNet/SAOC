# Golden: `lib/payments/active-gateway.ts`

New file. Server-only (imports `firebase-admin/firestore`). Mirrors
`lib/ozow-sandbox-test-mode.ts`'s shape exactly — fail-closed, deps-injectable, never throws.

```ts
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

/**
 * Mission gateway-picker-admin-only F1. See contracts/golden/gateway-picker-admin-only-f1/README.md
 * §2. Storage: adminSettings/activePaymentGateway, { gateway: 'ozow' | 'payfast', updatedAt,
 * updatedByEmail }. Sibling doc to adminSettings/ozowSandboxTestMode (ozow-sandbox-toggle F1) —
 * same collection, independent setting.
 */
export const ACTIVE_GATEWAY_COLLECTION = 'adminSettings';
export const ACTIVE_GATEWAY_DOC_ID = 'activePaymentGateway';

export const GATEWAY_IDS = ['ozow', 'payfast'] as const;
export type GatewayId = (typeof GATEWAY_IDS)[number];

export function isValidGatewayId(value: unknown): value is GatewayId {
  return typeof value === 'string' && (GATEWAY_IDS as readonly string[]).includes(value);
}

/**
 * Reads adminSettings/activePaymentGateway, fail-closed. Returns the stored gateway ONLY when
 * the doc exists AND `gateway` is a valid GatewayId. Every other outcome (missing doc, missing
 * field, unrecognised string, non-string value, a thrown read error) returns `null` — the
 * checkout route treats `null` as "refuse the charge", never as "pick a default gateway". See
 * README §3.
 */
export async function resolveActiveGateway(deps?: {
  db?: Pick<Firestore, 'collection'>;
}): Promise<GatewayId | null> {
  try {
    const db = deps?.db ?? getFirestore(initAdmin());
    const snapshot = await db
      .collection(ACTIVE_GATEWAY_COLLECTION)
      .doc(ACTIVE_GATEWAY_DOC_ID)
      .get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    const gateway = data?.gateway;
    return isValidGatewayId(gateway) ? gateway : null;
  } catch {
    return null;
  }
}
```

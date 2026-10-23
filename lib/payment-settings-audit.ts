import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Mission payment-gateway-settings M1. Audited writes for the two payment settings and a
 * recent-changes read. Server-only. `adminSettingsAudit` is Admin-SDK-only and append-only: no
 * code path updates or deletes an entry. The setting write and the audit entry share ONE
 * transaction, so a failed audit write fails the change (fail closed).
 */
export const PAYMENT_AUDIT_COLLECTION = 'adminSettingsAudit';
const SETTINGS_COLLECTION = 'adminSettings';
const AUDIT_MODE = 'sandbox'; // M1 has no other mode; recorded so later rows are attributable
const DEFAULT_RECENT_LIMIT = 10;

export const PAYMENT_SETTING_IDS = ['activePaymentGateway', 'ozowSandboxTestMode'] as const;
export type PaymentSettingId = (typeof PAYMENT_SETTING_IDS)[number];

type SettingValues = Record<string, string | boolean>;

export interface PaymentSettingsChange {
  id: string;
  setting: PaymentSettingId;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
  byEmail: string | null;
  at: Date | null;
}

function isPaymentSettingId(value: unknown): value is PaymentSettingId {
  return typeof value === 'string' && (PAYMENT_SETTING_IDS as readonly string[]).includes(value);
}

export async function writeAuditedSettingChange(
  db: Pick<Firestore, 'collection' | 'runTransaction'>,
  args: {
    setting: PaymentSettingId;
    next: SettingValues;
    actor: { uid: string; email: string | null };
  },
): Promise<{ changed: boolean; from: Record<string, unknown>; to: Record<string, unknown> }> {
  const { setting, next, actor } = args;
  if (!isPaymentSettingId(setting)) {
    throw new Error('Refusing to audit an unknown payment setting.');
  }

  const settingRef = db.collection(SETTINGS_COLLECTION).doc(setting);
  const auditRef = db.collection(PAYMENT_AUDIT_COLLECTION).doc();

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(settingRef);
    const stored = snapshot.exists ? (snapshot.data() ?? {}) : {};
    const from: Record<string, unknown> = {};
    for (const key of Object.keys(next)) {
      from[key] = stored[key] ?? null;
    }
    const to: Record<string, unknown> = { ...next };

    if (Object.keys(next).every((key) => from[key] === next[key])) {
      return { changed: false, from, to };
    }

    tx.set(settingRef, {
      ...next,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByEmail: actor.email ?? null,
    });
    tx.set(auditRef, {
      setting,
      from,
      to,
      mode: AUDIT_MODE,
      byUid: actor.uid,
      byEmail: actor.email ?? null,
      at: FieldValue.serverTimestamp(),
    });
    return { changed: true, from, to };
  });
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    // Duck-typed Timestamp, same approach as lib/firestore-serialization.ts (no instanceof import).
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/** Newest first. Plain Dates only, so the result can cross into a client component. */
export async function listRecentPaymentSettingsChanges(
  db: Pick<Firestore, 'collection'>,
  limit: number = DEFAULT_RECENT_LIMIT,
): Promise<PaymentSettingsChange[]> {
  const snapshot = await db
    .collection(PAYMENT_AUDIT_COLLECTION)
    .orderBy('at', 'desc')
    .limit(limit)
    .get();
  const changes: PaymentSettingsChange[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!isPaymentSettingId(data.setting)) continue;
    changes.push({
      id: doc.id,
      setting: data.setting,
      from: typeof data.from === 'object' && data.from !== null ? { ...data.from } : {},
      to: typeof data.to === 'object' && data.to !== null ? { ...data.to } : {},
      byEmail: typeof data.byEmail === 'string' ? data.byEmail : null,
      at: toDate(data.at),
    });
  }
  return changes;
}

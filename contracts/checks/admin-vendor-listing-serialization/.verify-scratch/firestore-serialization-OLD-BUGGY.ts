// Reconstruction of the pre-fix, hardcoded-allowlist implementation Codex GPT-5.5 flagged
// (cited at lib/firestore-serialization.ts:54), used ONLY to prove the widened fixture would
// have caught it. Never a production file.
function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value as Date;
}

const VENDOR_APPLICATION_TIMESTAMP_FIELDS = [
  'submittedAt',
  'reviewedAt',
  'registrationTokenIssuedAt',
  'registrationTokenExpiresAt',
  'registrationTokenConsumedAt',
] as const;

const VENDOR_SUBMISSION_TIMESTAMP_FIELDS = ['submittedAt', 'reviewedAt'] as const;

export function serializeVendorApplication(id: string, data: Record<string, unknown>) {
  const result: Record<string, unknown> = { id, ...data };
  for (const field of VENDOR_APPLICATION_TIMESTAMP_FIELDS) {
    result[field] = toDateOrNull(data[field]);
  }
  return result;
}

export function serializeVendorSubmission(id: string, data: Record<string, unknown>) {
  const result: Record<string, unknown> = { id, ...data };
  for (const field of VENDOR_SUBMISSION_TIMESTAMP_FIELDS) {
    result[field] = toDateOrNull(data[field]);
  }
  return result;
}

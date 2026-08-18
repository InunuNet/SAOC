// FIXTURE — CLEAN. Self-test golden for check-no-verification-logic-exists.mjs. The scanner
// must NOT flag this file -- it merely stores and displays the permit number, doing nothing
// that looks like verification or external lookup.
export interface PermitFields {
  phytosanitaryPermitNumber?: string;
  citesPermitNumber?: string;
  foodHandlingCertificateNumber?: string;
}

export function formatPermitField(value: string | undefined): string {
  return value ?? '—';
}

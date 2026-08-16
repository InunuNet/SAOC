// Shared harness for the payfast-m1 ITN behavioural checks (A18–A21, A30–A31).
//
// WHY DIRECT IMPORT, NOT HTTP
// contracts/checks/ticketing-hardening/check-itn-does-not-resurrect-checked-in.mts (S4)
// documents that an ITN sent over real HTTP to a running dev server is structurally
// unable to reach the write path: it dies at the source-IP gate (step 2 resolves
// PayFast's published hosts via DNS — a dev-server request never originates from one of
// those IPs) and, past that, at the server-confirm gate (step 4 only returns 'VALID' for
// a payment PayFast actually processed). That is correct for S4's purpose (proving no
// resurrection from a route that can never be driven further), but it means every
// "detection gap" assertion the audit flagged (A18–A21, A30–A32) was UNTESTABLE
// end-to-end the same way — which is exactly why those assertions degraded to greps.
//
// This harness closes that gap without touching the pinned route: it dynamically
// imports app/api/tickets/itn/route.ts and calls the exported POST() directly, in
// process, with a hand-built Request-shaped object. That sidesteps needing a real
// PayFast-originated HTTP connection while still exercising the SAME code:
//   - Source IP (step 2): resolvePayfastIps() does a REAL dns.lookup() against PayFast's
//     real hostnames — we let it. We ALSO do a real DNS lookup of sandbox.payfast.co.za
//     ourselves and place that genuinely-resolved IP in the X-Forwarded-For header at the
//     second-to-last hop (see lib/payfast.ts getClientIp — GCLB appends
//     "<client>,<lb>", so the real client IP is always the second-to-last hop). No
//     mocking, no IP allowlist stub — a route that stopped resolving DNS for real would
//     fail this exactly as it would fail in production.
//   - Server confirmation (step 4): `fetch` in route.ts is the bare global, not an
//     import, so it is interceptable by reassigning `globalThis.fetch` for the duration
//     of the call and restoring it afterwards.
//   - Signature (step 1): built via the REAL exported generateSignature from
//     lib/payfast.ts against process.env.PAYFAST_SANDBOX_PASSPHRASE loaded from
//     .env.local — never a hardcoded/committed signature.
//
// Every check using this harness writes its fixture straight into Firestore (real
// Firestore, sentinel-email marked) via contracts/checks/ticketing-hardening/_shared.mjs
// and reads the result back the same way — reused, not reinvented, per the task brief.

import { promises as dns } from 'node:dns';

import { config } from 'dotenv';

config({ path: new URL('../../../.env.local', import.meta.url).pathname, quiet: true });

/** Never a real PayFast address — TEST-NET-3 (RFC 5737), guaranteed unroutable/reserved. */
export const BOGUS_SOURCE_IP = '203.0.113.1';

const REAL_DNS_HOST = 'sandbox.payfast.co.za';

export function credentialsAvailable(): boolean {
  return Boolean(
    process.env.PAYFAST_SANDBOX_PASSPHRASE &&
      process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

/**
 * Shared skip convention for this directory: precondition failures caused by missing
 * local-only credentials are NOT a pass and must never look like one. Printed to stderr
 * as a GitHub Actions warning annotation (visible in Actions logs even though these
 * checks cannot actually run there — see the module header of each check script for
 * why) and exits 0 so the local gate does not hard-fail a workstation that legitimately
 * lacks sandbox/admin secrets, while making the skip impossible to mistake for a green
 * result on inspection.
 */
export function skipForMissingCredentials(assertionId: string): never {
  console.error(
    `::warning::PAYFAST/Firestore credentials not available — skipping ${assertionId}, this is NOT a pass`
  );
  process.exit(0);
}

/** Real DNS resolution of one of PayFast's published ITN hosts — same call the route
 * itself makes in resolvePayfastIps(). Used to build a genuinely-valid source IP. */
export async function realPayfastIp(): Promise<string> {
  const results = await dns.lookup(REAL_DNS_HOST, { all: true });
  if (results.length === 0) {
    throw new Error(
      `DNS lookup for ${REAL_DNS_HOST} returned no results — cannot build a genuine source-IP fixture.`
    );
  }
  return results[0].address;
}

/** Build an X-Forwarded-For value with `sourceIp` at the second-to-last hop, matching
 * GCLB's "<client-supplied>,<client-ip>,<lb-ip>" shape that lib/payfast.ts getClientIp()
 * trusts. */
export function buildXff(sourceIp: string): string {
  return `198.51.100.7, ${sourceIp}, 10.0.0.1`;
}

/** A minimal Request-shaped object satisfying everything route.ts actually calls:
 * request.text() and request.headers.get(name). Not a real NextRequest — the route
 * never uses anything else from it. */
export function buildItnRequest({ body, xff }: { body: string; xff?: string }) {
  const headers = new Map<string, string>();
  if (xff) headers.set('x-forwarded-for', xff);
  return {
    text: async () => body,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
  } as unknown as import('next/server').NextRequest;
}

/**
 * Dynamically load the route's POST handler. `ITN_ROUTE_IMPORT_OVERRIDE` is NOT part of
 * normal operation — every committed assertion here calls this with the env var unset,
 * which always imports the real, pinned app/api/tickets/itn/route.ts. It exists solely
 * so the one-off manual proof step (run a check against a scratch copy with a single
 * injected defect, show it FAILS; run it again unset against the real file, show it
 * PASSES) does not require ever editing the production import path.
 */
export async function loadItnPost() {
  const override = process.env.ITN_ROUTE_IMPORT_OVERRIDE;
  const mod = override
    ? await import(/* @vite-ignore */ override)
    : await import('@/app/api/tickets/itn/route');
  if (typeof mod.POST !== 'function') {
    throw new Error(
      `${override ?? 'app/api/tickets/itn/route.ts'} does not export POST — cannot drive the harness.`
    );
  }
  return mod.POST as (request: import('next/server').NextRequest) => Promise<Response>;
}

export type ConfirmStub = (...args: unknown[]) => Promise<{ status: number; text: () => Promise<string> }>;

export function confirmStub(body: string, status = 200): ConfirmStub {
  return async () => ({ status, text: async () => body });
}

/** Reassign the bare global `fetch` for the duration of `fn`, recording every call, then
 * restore the original regardless of outcome. */
export async function withFetchStub<T>(
  stub: ConfirmStub,
  fn: () => Promise<T>
): Promise<{ result: T; calls: unknown[][] }> {
  const original = globalThis.fetch;
  const calls: unknown[][] = [];
  // @ts-expect-error — intentionally narrowing the global fetch signature for the stub
  globalThis.fetch = async (...args: unknown[]) => {
    calls.push(args);
    return stub(...args);
  };
  try {
    const result = await fn();
    return { result, calls };
  } finally {
    globalThis.fetch = original;
  }
}

/** Default four-field ITN payload shape used across the suite. Field ORDER here is the
 * signature base-string order (insertion order — see lib/payfast.ts generateSignature),
 * not alphabetical. */
export function itnFields(overrides: {
  mPaymentId: string;
  amountGross: string;
  paymentStatus?: string;
  pfPaymentId?: string;
}): Record<string, string> {
  return {
    m_payment_id: overrides.mPaymentId,
    pf_payment_id: overrides.pfPaymentId ?? `pfm1-${Math.random().toString(36).slice(2, 10)}`,
    payment_status: overrides.paymentStatus ?? 'COMPLETE',
    item_name: 'SAOC 2027 National Show Ticket',
    amount_gross: overrides.amountGross,
  };
}

/** Sign `fields` with the real exported generateSignature + the real sandbox passphrase
 * from .env.local, and build the exact urlencoded body the route's own
 * parseOrderedFields() will parse back into the same field order. */
export async function signAndEncode(fields: Record<string, string>): Promise<string> {
  const { generateSignature } = await import('@/lib/payfast');
  const signature = generateSignature(fields, process.env.PAYFAST_SANDBOX_PASSPHRASE);
  return new URLSearchParams({ ...fields, signature }).toString();
}

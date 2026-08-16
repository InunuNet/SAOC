import { createHash } from 'node:crypto';

/**
 * PayFast Sandbox integration constants and signature helper.
 *
 * Verified live against https://developers.payfast.co.za/docs (2026-07-03):
 * - Signature field order = insertion/attribute order, NOT alphabetical (that's the
 *   separate API-key signature format, which this project does not use).
 * - URL-encoding must match PHP's `urlencode()` (RFC 1738): alphanumeric plus `- _ .`
 *   are left unescaped, space becomes `+`, everything else (including `~`) is
 *   percent-encoded with uppercase hex. This differs from `encodeURIComponent`, which
 *   also leaves `! ~ * ' ( )` unescaped and encodes space as `%20`.
 * - ITN source hosts and the `/eng/query/validate` server-confirm endpoint match
 *   contracts/golden/payfast-m1/payfast-hosts.golden.json exactly — no correction needed.
 */

export const PAYFAST_SANDBOX_HOST = 'sandbox.payfast.co.za';

export const PAYFAST_SANDBOX_PROCESS_URL = `https://${PAYFAST_SANDBOX_HOST}/eng/process`;

export const PAYFAST_SANDBOX_VALIDATE_URL = `https://${PAYFAST_SANDBOX_HOST}/eng/query/validate`;

/** PayFast's published valid ITN source hostnames. Resolve via DNS at request time — never
 * hardcode IPs, PayFast rotates them. */
export const PAYFAST_ITN_HOSTS = [
  'www.payfast.co.za',
  PAYFAST_SANDBOX_HOST,
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
] as const;

/**
 * Percent-encode a string per PHP's `urlencode()` (RFC 1738) semantics: alphanumeric and
 * `- _ .` pass through unescaped, space becomes `+`, everything else is `%XX` uppercase hex.
 * This is what PayFast's own signature example (PHP `urlencode()`) produces — it is NOT the
 * same as `encodeURIComponent`, which additionally leaves `! ~ * ' ( )` unescaped.
 */
function phpUrlEncode(value: string): string {
  const bytes = Buffer.from(value, 'utf8');
  let result = '';
  for (const byte of bytes) {
    const char = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-_.]/.test(char)) {
      result += char;
    } else if (char === ' ') {
      result += '+';
    } else {
      result += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return result;
}

/**
 * Build the PayFast parameter string: `key=urlencode(value)` for each non-empty field IN
 * THE GIVEN (insertion) ORDER, joined by `&`. This is the same string PayFast's own
 * server-confirm callback (F3, step 4) expects as its POST body — built WITHOUT a
 * passphrase appended.
 */
export function buildPayfastParamString(fields: Record<string, string>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === '') continue;
    pairs.push(`${key}=${phpUrlEncode(value.trim())}`);
  }
  return pairs.join('&');
}

/**
 * Generate a PayFast MD5 signature.
 *
 * Builds the parameter string via `buildPayfastParamString`, appends
 * `&passphrase=urlencode(passphrase)` only when a passphrase is supplied, then returns
 * the lowercase hex MD5 digest.
 *
 * Used both to sign the outbound checkout form (F2) and to verify an inbound ITN
 * notification (F3) — for ITN verification, pass the fields in the exact order received
 * from PayFast (excluding the posted `signature` field itself).
 */
export function generateSignature(
  fields: Record<string, string>,
  passphrase?: string | null
): string {
  let paramString = buildPayfastParamString(fields);
  if (passphrase) {
    paramString += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  }

  return createHash('md5').update(paramString).digest('hex');
}

/**
 * Build the PayFast INBOUND (ITN verification) parameter string.
 *
 * PayFast documents TWO DIFFERENT algorithms for its parameter string — an outbound one
 * used to sign the checkout form, and a separate inbound one used to verify a posted ITN
 * and to build the server-confirm POST body. They are genuinely different (posted order
 * vs insertion order is the same in practice, but inbound does NOT skip blank fields and
 * does NOT trim() values) and are deliberately kept as two separate functions here rather
 * than unified into one — a prior version of this file reused the outbound builder
 * (`buildPayfastParamString`) for the inbound path, which recomputes a digest that real
 * PayFast ITNs (which always contain multiple blank fields, e.g. `name_last`,
 * `custom_str1..5`) can never match. See
 * contracts/golden/payfast-itn-signature/inbound-algorithm.golden.md for the verbatim
 * PayFast PHP reference. Iterate `fields` in the EXACT order the caller received them
 * (the caller is responsible for posted-order preservation) and include every field,
 * blank or not, unmodified except for `phpUrlEncode`.
 */
export function buildPayfastNotifyParamString(fields: Record<string, string>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    pairs.push(`${key}=${phpUrlEncode(value)}`);
  }
  return pairs.join('&');
}

/**
 * Generate a PayFast MD5 signature for INBOUND ITN verification.
 *
 * Builds the parameter string via `buildPayfastNotifyParamString` (posted order, no
 * blank-skip, no trim), appends `&passphrase=urlencode(passphrase)` — with NO trim() on
 * the passphrase either, matching PayFast's documented `pfValidSignature()` — only when a
 * passphrase is supplied, then returns the lowercase hex MD5 digest.
 *
 * This is deliberately separate from `generateSignature` (outbound). Do not unify them —
 * see the comment on `buildPayfastNotifyParamString` for why. These two exports are
 * unused until app/api/tickets/itn/route.ts (currently sha256-pinned) is updated to call
 * them — that is expected; do not delete them as dead code.
 */
export function generateNotifySignature(
  fields: Record<string, string>,
  passphrase?: string | null
): string {
  let paramString = buildPayfastNotifyParamString(fields);
  if (passphrase) {
    paramString += `&passphrase=${phpUrlEncode(passphrase)}`;
  }

  return createHash('md5').update(paramString).digest('hex');
}

/**
 * Trust boundary: Firebase App Hosting is NOT bare Cloud Run. Per
 * https://firebase.google.com/docs/app-hosting/about-app-hosting, "the request is served
 * by Google Cloud Load Balancer with Cloud CDN enabled. Uncached requests are sent to your
 * Cloud Run service" — there is a full external Google Cloud Load Balancer (GCLB) in front
 * of Cloud Run. Per https://cloud.google.com/load-balancing/docs/https, GCLB APPENDS TWO
 * entries to X-Forwarded-For, in this order: "The IP address of the client that connects
 * to the load balancer[;] The IP address of the load balancer's forwarding rule". So the
 * header GCLB forwards to Cloud Run is `<client-supplied-value>,<client-ip>,<load-balancer-ip>`
 * — every entry the caller supplied (including a spoofed one) still lands before those two,
 * and the LAST entry is always the load balancer's own IP, never the client's. The real,
 * infrastructure-verified client IP is therefore the SECOND-TO-LAST hop, not the last one.
 * Taking the last hop (an earlier version of this function) always resolves to the load
 * balancer's own IP, which never matches a PayFast-resolved host IP — every legitimate ITN
 * would be rejected. Taking the first hop is a spoofable IP-allowlist bypass.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    const clientHop = hops[hops.length - 2];
    if (clientHop) return clientHop;
  }
  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() ?? null;
}

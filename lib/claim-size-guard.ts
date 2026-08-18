/**
 * Shared claim-size guard for every custom-claims mutation site (scripts/admin-grant.ts,
 * scripts/admin-revoke.ts, scripts/admin-migrate-roles.ts). Firebase caps a user's total
 * custom-claims payload at 1000 bytes and rejects setCustomUserClaims() with
 * `auth/claims-too-large` beyond it, with no advance warning. This module refuses BEFORE that
 * call, deterministically, with our own message — an operator must never see the raw Firebase
 * error. See contracts/golden/role-path-hardening/README.md for the threshold rationale.
 */

export const CLAIM_SIZE_HARD_LIMIT_BYTES = 1000;
export const CLAIM_SIZE_REFUSE_THRESHOLD_BYTES = 950;
export const CLAIM_SIZE_WARN_THRESHOLD_BYTES = 800;

export type ClaimSizeCheckResult =
  | { status: 'ok'; bytes: number }
  | { status: 'warn'; bytes: number }
  | { status: 'refuse'; bytes: number };

/** Buffer.byteLength on the UTF-8 JSON serialization — the same measure Firebase applies. */
export function checkClaimSize(claims: unknown): ClaimSizeCheckResult {
  const bytes = Buffer.byteLength(JSON.stringify(claims), 'utf8');
  if (bytes >= CLAIM_SIZE_REFUSE_THRESHOLD_BYTES) return { status: 'refuse', bytes };
  if (bytes >= CLAIM_SIZE_WARN_THRESHOLD_BYTES) return { status: 'warn', bytes };
  return { status: 'ok', bytes };
}

/**
 * Throws BEFORE any setCustomUserClaims call when `claims` is at/above the refuse threshold.
 * Logs (never throws) at the warn threshold — warn is advisory, never blocking. Silent at ok.
 * `context` identifies the call site/operator-facing action for the thrown message and the log.
 */
export function assertClaimSizeOrThrow(claims: unknown, context: string): void {
  const result = checkClaimSize(claims);
  if (result.status === 'refuse') {
    throw new Error(
      `Refusing to write custom claims for ${context}: ${result.bytes} bytes >= ` +
        `${CLAIM_SIZE_REFUSE_THRESHOLD_BYTES}-byte refuse threshold (Firebase's hard limit is ` +
        `${CLAIM_SIZE_HARD_LIMIT_BYTES} bytes). Trim role grants — split org-wide vs per-show, ` +
        `or grant fewer shows to this identity — and retry.`,
    );
  }
  if (result.status === 'warn') {
    console.warn('[claim-size-guard] approaching the custom-claims size limit', {
      operation: context,
      bytes: result.bytes,
      warnThresholdBytes: CLAIM_SIZE_WARN_THRESHOLD_BYTES,
      refuseThresholdBytes: CLAIM_SIZE_REFUSE_THRESHOLD_BYTES,
    });
  }
}

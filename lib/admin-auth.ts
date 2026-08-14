import { cookies } from 'next/headers';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

import { initAdmin } from '@/lib/firebase-admin';

/**
 * Single home for the admin authorisation decision. See
 * contracts/golden/admin-auth-hardening/admin-auth-gate.golden.md for the policy spec.
 *
 * A token is admin if, and only if, ALL of:
 *   1. decoded.admin === true (strict boolean — no 'role' claim fallback; nothing in
 *      this repo ever sets a 'role' claim, so that branch was dead attack surface).
 *   2. decoded.email_verified === true.
 *   3. isEmailAllowlisted(decoded.email), re-checked live on every call.
 *
 * Fails closed on every unenumerated state — missing/malformed claim, unverified
 * email, verified email not on the allowlist, missing/invalid session cookie.
 */

export type AdminAuthResult =
  | { ok: true; decodedToken: DecodedIdToken }
  | {
      ok: false;
      reason: 'no-session' | 'invalid-session' | 'no-claim' | 'email-unverified' | 'not-allowlisted';
    };

let loggedAllowlistLength = false;

function parseAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? '';
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  // Logged once per process, length only — never the values (see project rule against
  // logging secrets). A visible `0` here is the unambiguous signal this project's
  // secret-corruption incidents were missing: a mis-copied env var yields an empty
  // allowlist that fails closed for everyone and looks identical to a working gate
  // from outside.
  if (!loggedAllowlistLength) {
    loggedAllowlistLength = true;
    console.info(`[admin-auth] ADMIN_EMAIL_ALLOWLIST parsed length: ${parsed.length}`);
  }

  return parsed;
}

export function isEmailAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = parseAllowlist();
  return allowlist.includes(email.trim().toLowerCase());
}

export function isAdminToken(decoded: DecodedIdToken | null | undefined): boolean {
  if (!decoded) return false;
  if (decoded.admin !== true) return false;
  if (decoded.email_verified !== true) return false;
  if (!isEmailAllowlisted(decoded.email)) return false;
  return true;
}

function classifyRefusal(decoded: DecodedIdToken): AdminAuthResult {
  if (decoded.admin !== true) return { ok: false, reason: 'no-claim' };
  if (decoded.email_verified !== true) return { ok: false, reason: 'email-unverified' };
  return { ok: false, reason: 'not-allowlisted' };
}

export async function getAdminSession(): Promise<AdminAuthResult> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return { ok: false, reason: 'no-session' };
    }

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await getAuth(initAdmin()).verifySessionCookie(sessionCookie, true);
    } catch {
      return { ok: false, reason: 'invalid-session' };
    }

    if (!isAdminToken(decodedToken)) {
      return classifyRefusal(decodedToken);
    }

    return { ok: true, decodedToken };
  } catch {
    // Never throw — a caller that forgets a try/catch must still fail closed.
    return { ok: false, reason: 'invalid-session' };
  }
}

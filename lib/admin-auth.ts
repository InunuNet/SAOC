import { cookies } from 'next/headers';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

import { initAdmin } from './firebase-admin';
import { resolve, type Capability } from './admin-roles';

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

/**
 * Classifies why a decoded token failed `isAdminToken()`, and logs that refusal
 * server-side — WARNING level, `reason` and the attempted `email` only, never the ID
 * token or any other claim. This is the log the "Reading the reason field" and
 * `docs/admin-access.md` "Apple sign-in" (privaterelay.appleid.com capture fallback)
 * sections both depend on; it must never travel to the browser (see `mintSession()` in
 * `app/admin/login/page.tsx`, which reads only `response.status`, never the body).
 */
export function classifyRefusal(decoded: DecodedIdToken): Extract<AdminAuthResult, { ok: false }> {
  const result: Extract<AdminAuthResult, { ok: false }> =
    decoded.admin !== true
      ? { ok: false, reason: 'no-claim' }
      : decoded.email_verified !== true
        ? { ok: false, reason: 'email-unverified' }
        : { ok: false, reason: 'not-allowlisted' };

  console.warn('[admin-auth] refused', {
    operation: 'admin authorisation check',
    reason: result.reason,
    email: decoded.email,
  });

  return result;
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

// ---------------------------------------------------------------------------------------------
// F4 — the `roles` custom claim, AND-only composition with `admin:true`. See
// contracts/golden/ticketing-f4-roles-claim/README.md for the full decision record (spec
// §5.4-§5.6). Builds on F3's lib/admin-roles.ts (CAPABILITIES, ROLE_NAMES,
// ROLE_TO_CAPABILITIES, resolve()), unmodified.
// ---------------------------------------------------------------------------------------------

/**
 * A show ID maps to the list of role names held for that scope. `'*'` is the org-wide scope —
 * never date-limited. Untrusted, mutable-by-a-future-editor data at runtime (a Firebase custom
 * claim), not a compile-time-checked literal — role-name resolution within each array delegates
 * to lib/admin-roles.ts's `resolve()`, which already fails closed on unrecognised names.
 */
export type RolesClaim = Record<string, string[]>;

/** The live date window a specific show's role grants are honoured within. */
export interface ShowWindow {
  startDate: Date;
  endDate: Date;
}

/**
 * A pure function from `showId` to that show's date window, or `null` if the show can't be
 * found. Injected, not read live from Sanity inside `resolveRoleCapabilitiesForShow` — see the
 * golden README's "Why the date-window lookup is injected" for the hot-path reasoning (spec
 * §5.4, §5.6). A `null` result means the per-show grant is refused, not defaulted open.
 */
export type ShowWindowLookup = (showId: string) => ShowWindow | null;

function isWithinWindow(now: Date, window: ShowWindow): boolean {
  return now >= window.startDate && now <= window.endDate;
}

/**
 * Unions `roles['*']` (never date-limited) with `roles[showId]` (honoured only while `now`
 * falls within `showId`'s date window, as returned by `lookupShowWindow`). A `null` lookup
 * result means the per-show grant is not honoured, not defaulted open. Unknown role names
 * inside either array resolve via `resolve()` — they contribute nothing, exactly as F3 already
 * proved for that function in isolation.
 */
export function resolveRoleCapabilitiesForShow(
  roles: RolesClaim | null | undefined,
  showId: string,
  opts: { now: Date; lookupShowWindow: ShowWindowLookup },
): Set<Capability> {
  const result = new Set<Capability>();
  if (!roles) return result;

  const orgWideRoleNames = roles['*'];
  if (orgWideRoleNames) {
    for (const capability of resolve(orgWideRoleNames)) result.add(capability);
  }

  const perShowRoleNames = roles[showId];
  if (perShowRoleNames) {
    const window = opts.lookupShowWindow(showId);
    if (window && isWithinWindow(opts.now, window)) {
      for (const capability of resolve(perShowRoleNames)) result.add(capability);
    }
  }

  return result;
}

/**
 * The single entry point route code calls. Gates on `isAdminToken(decoded)` FIRST — a role
 * never substitutes for `admin:true` — and only then checks whether the role-derived capability
 * set contains `capability`. `admin:true` alone never satisfies a capability requirement. This
 * one `if`-then-check is the entire AND-only composition; there is no third code path. See the
 * golden README's "Why hasCapability reuses isAdminToken" for why this delegates rather than
 * re-implements the admin/verified/allowlisted gate.
 */
export function hasCapability(
  decoded: DecodedIdToken | null | undefined,
  showId: string,
  capability: Capability,
  opts?: { now?: Date; lookupShowWindow?: ShowWindowLookup },
): boolean {
  // The explicit `!decoded` check (redundant with isAdminToken's own null check) is what lets
  // TypeScript narrow `decoded` to non-null below — isAdminToken() returns a plain boolean, not
  // a type predicate, so calling it alone doesn't narrow across the function-call boundary.
  if (!decoded || !isAdminToken(decoded)) return false;

  const now = opts?.now ?? new Date();
  const lookupShowWindow = opts?.lookupShowWindow ?? (() => null);

  // DecodedIdToken carries an index signature (`[key: string]: any`) for custom claims, so
  // `.roles` is accessible without a cast beyond narrowing its type to RolesClaim.
  const roles = decoded.roles as RolesClaim | undefined;

  return resolveRoleCapabilitiesForShow(roles, showId, { now, lookupShowWindow }).has(capability);
}

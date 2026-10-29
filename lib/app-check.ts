/**
 * Server-side Firebase App Check for the checkout POST only (spec.md D7). Behind the runtime
 * flag APP_CHECK_ENFORCE_CHECKOUT, read on every call (App Hosting supplies it at RUNTIME only,
 * so it is never captured at module load).
 *
 * Off (unset, empty, or false/0/off/no in any case): a no-op that never calls the verifier, so no
 * token is consumed and no network call is made. Any other set value enforces, so a typo cannot
 * silently disable it. On: a missing, invalid, expired, replayed token, or an App Check backend
 * failure, all refuse; the backend being down is never a pass.
 *
 * Tokens are verified as limited-use and consumed on verification (Google's replay protection:
 * accepted once). The payment notification routes, reconcile, revalidate and the proxy never
 * reference this module.
 */

export const APP_CHECK_HEADER = 'x-firebase-appcheck';
export const APP_CHECK_ENFORCE_ENV = 'APP_CHECK_ENFORCE_CHECKOUT';

const OFF_VALUES = new Set(['', 'false', '0', 'off', 'no']);
// Codes copied from firebase-admin 14 lib/app-check/token-verifier.js.
const INVALID_TOKEN_CODES = new Set(['app-check/invalid-argument', 'app-check/app-check-token-expired']);

export type AppCheckDecision =
  | { ok: true; enforced: boolean }
  | { ok: false; reason: 'missing' | 'invalid' | 'replayed' | 'unavailable' };

interface HeaderReader {
  get(name: string): string | null;
}

export interface AppCheckDeps {
  env?: Record<string, string | undefined>;
  verify?: (token: string) => Promise<{ alreadyConsumed?: boolean }>;
}

export function isAppCheckEnforced(value: string | undefined): boolean {
  // anchor: appcheck-flag
  return !OFF_VALUES.has((value ?? '').trim().toLowerCase());
}

async function verifyWithAdminSdk(token: string): Promise<{ alreadyConsumed?: boolean }> {
  const { getAppCheck } = await import('firebase-admin/app-check');
  const { initAdmin } = await import('./firebase-admin');
  return getAppCheck(initAdmin()).verifyToken(token, { consume: true });
}

export async function requireCheckoutAppCheck(
  headers: HeaderReader,
  deps: AppCheckDeps = {},
): Promise<AppCheckDecision> {
  const env = deps.env ?? process.env;
  if (!isAppCheckEnforced(env[APP_CHECK_ENFORCE_ENV])) return { ok: true, enforced: false };

  const token = headers.get(APP_CHECK_HEADER)?.trim() ?? '';
  if (token === '') return { ok: false, reason: 'missing' };

  try {
    const result = await (deps.verify ?? verifyWithAdminSdk)(token);
    // anchor: appcheck-replay
    if (result.alreadyConsumed) return { ok: false, reason: 'replayed' };
    return { ok: true, enforced: true };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && INVALID_TOKEN_CODES.has(code)) {
      return { ok: false, reason: 'invalid' };
    }
    console.error('[app-check] verification backend failed', {
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, reason: 'unavailable' };
  }
}

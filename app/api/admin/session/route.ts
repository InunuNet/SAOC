import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

import { classifyRefusal, isAdminToken } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';

const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: NextRequest) {
  const body = await request.json() as { idToken?: unknown };
  const { idToken } = body;

  if (typeof idToken !== 'string' || !idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
  }

  let decodedIdToken: DecodedIdToken;
  try {
    decodedIdToken = await getAuth(initAdmin()).verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 });
  }

  if (!isAdminToken(decodedIdToken)) {
    // classifyRefusal() logs the reason + attempted email server-side (see its doc
    // comment in lib/admin-auth.ts) — the response body below stays a generic 403,
    // unchanged, so the browser never learns why.
    classifyRefusal(decodedIdToken);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let sessionCookie: string;
  try {
    sessionCookie = await getAuth(initAdmin()).createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set('session', sessionCookie, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// Sign-out (F1 admin-nav-menu, hardened by admin-signout-revocation F1). Same file as
// POST — one choke point for session lifecycle, not a new route. No request body, no
// auth check: clearing a cookie that may already be absent, expired, or invalid is
// always safe, and requiring a valid session to sign out would make it impossible to
// sign out of an already-broken one.
//
// Clearing the cookie alone only logs the calling browser out — a session cookie
// exfiltrated before sign-out would otherwise stay valid for its full ~5-day life.
// This also revokes the signed-out user's Firebase refresh tokens server-side, so the
// cookie is refused everywhere (lib/admin-auth.ts checks revocation on every request
// via verifySessionCookie(cookie, true)), not just cleared locally.
export async function DELETE() {
  // Step 1: resolve a uid from the request's OWN 'session' cookie ONLY — never from a
  // body, query string, header, or any other client-supplied field. Revocation is
  // global per-user (see step 2 comment), so honouring a client-supplied uid would let
  // an unauthenticated caller force-sign-out any admin by naming their uid. This
  // handler deliberately takes no arguments and reads no request body/query for that
  // reason — do not add one.
  //
  // Isolated in its own try/catch, separate from the unconditional cookie clear below:
  // an absent, expired, malformed, or otherwise unresolvable cookie must never prevent
  // sign-out from succeeding for the caller.
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get('session')?.value;

  let uid: string | undefined;
  if (existingCookie) {
    try {
      // checkRevoked=true (2nd arg) is required here, not optional: without it, an
      // already-revoked cookie still verifies and still resolves a uid, letting a
      // stolen-but-already-signed-out-of cookie trigger a repeatable, indefinite
      // force-sign-out of the real admin's other sessions. See "Codex finding
      // (2026-08-19)" in the golden README for the full attack this closes.
      const decoded = await getAuth(initAdmin()).verifySessionCookie(existingCookie, true);
      uid = decoded.uid;
    } catch {
      // Malformed, expired, tampered, or already-revoked — nothing to revoke, fall
      // through to the unconditional clear below.
    }
  }

  // Step 2: best-effort revoke. revokeRefreshTokens(uid) invalidates ALL of that
  // user's refresh tokens — every device, every tab, not just the one that clicked
  // "Sign out". That is the deliberate, correct behaviour for a security sign-out
  // action (it is what actually remediates an exfiltrated cookie), not an incidental
  // side effect. A failure here (Admin SDK error, network error) must never turn into
  // a failed sign-out from the caller's point of view, so it's logged and swallowed.
  if (uid) {
    try {
      await getAuth(initAdmin()).revokeRefreshTokens(uid);
    } catch (error) {
      console.warn('[admin-session] revoke failed', {
        operation: 'DELETE /api/admin/session',
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Step 3: unconditionally clear the cookie, regardless of whether step 1/2
  // succeeded, failed, or had nothing to do.
  cookieStore.set('session', '', {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: 0,
  });

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

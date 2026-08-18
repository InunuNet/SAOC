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

// Sign-out (F1 admin-nav-menu). Same file as POST — one choke point for session
// lifecycle, not a new route. No request body, no auth check: clearing a cookie that
// may already be absent, expired, or invalid is always safe, and requiring a valid
// session to sign out would make it impossible to sign out of an already-broken one.
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set('session', '', {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: 0,
  });

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

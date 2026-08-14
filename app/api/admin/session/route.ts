import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

import { isAdminToken } from '@/lib/admin-auth';
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

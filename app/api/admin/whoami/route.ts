import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';

// Tells the admin pill (components/admin/AdminPill.tsx) whether the visitor is a signed-in
// admin. Session-gated by the same helper as every other admin surface; the answer is a
// boolean and an email, never token contents. Never cacheable: it is per-visitor.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await getAdminSession();
  if (!session.ok) {
    return NextResponse.json({ admin: false }, { status: 401, headers: NO_STORE });
  }
  return NextResponse.json(
    { admin: true, email: session.decodedToken.email ?? null },
    { status: 200, headers: NO_STORE },
  );
}

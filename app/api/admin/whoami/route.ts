import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { createLogBudget, describeForwardedForShape } from '@/lib/forwarded-for-shape';

// Tells the admin pill (components/admin/AdminPill.tsx) whether the visitor is a signed-in
// admin. Session-gated by the same helper as every other admin surface; the answer is a
// boolean and an email, never token contents. Never cacheable: it is per-visitor.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

// Temporary observation of the X-Forwarded-For chain on App Hosting (see
// lib/forwarded-for-shape.ts). Logs address-free counts only, and only for a request that
// carries the probe header, at most MAX_SHAPE_LOG_LINES per server instance lifetime; the
// response is identical in every case. Remove once the hop is known.
const HOP_PROBE_HEADER = 'x-saoc-hop-probe';
const MAX_SHAPE_LOG_LINES = 20;
const shapeLogBudget = createLogBudget(MAX_SHAPE_LOG_LINES);

export async function GET(request: Request) {
  if (request.headers.get(HOP_PROBE_HEADER) === '1' && shapeLogBudget.tryTake()) {
    console.info('[xff-shape]', JSON.stringify(describeForwardedForShape(request.headers)));
  }
  const session = await getAdminSession();
  if (!session.ok) {
    return NextResponse.json({ admin: false }, { status: 200, headers: NO_STORE });
  }
  return NextResponse.json(
    { admin: true, email: session.decodedToken.email ?? null },
    { status: 200, headers: NO_STORE },
  );
}

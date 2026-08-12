import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

// F3 (ticketing-pages) — read-only status endpoint so /tickets/confirmation can poll
// without claiming success or failure prematurely (the PayFast ITN race). Returns the
// absolute minimum: { status }. No name, email, price paid, or internal ids (see
// contracts/golden/ticketing-m1-m2/status-endpoint-response.golden.json).
// Unauthenticated by necessity — the buyer has no account, only the ref in their return
// URL. Booking refs are 60 bits (lib/booking-ref.ts), so this is not enumerable; but
// anyone holding a ref — a photo of a ticket — can see its check-in state, so "status
// only" stays the load-bearing mitigation and must not be widened. Per-IP rate limiting
// is deferred to F6.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ref = request.nextUrl.searchParams.get('ref');
  if (!ref || ref.trim().length === 0) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    initAdmin();
    const db = getFirestore();
    const snapshot = await db.collection('tickets').where('bookingRef', '==', ref).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const status = snapshot.docs[0]?.data()['status'] as string | undefined;
    if (!status) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('[tickets/status] Failed to look up ticket status:', error);
    return NextResponse.json({ error: 'Unable to check status. Please try again.' }, {
      status: 500,
    });
  }
}

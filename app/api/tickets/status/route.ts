import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

// F3 (ticketing-pages) — read-only status endpoint so /tickets/confirmation can poll
// without claiming success or failure prematurely (the PayFast ITN race). Returns the
// absolute minimum: { status }. No name, email, price paid, or internal ids — a booking
// ref is guessable enough (SAOC-2027- + 6 digits) that "return only status" is the
// load-bearing mitigation for this pass (see
// contracts/golden/ticketing-m1-m2/status-endpoint-response.golden.json). Per-IP rate
// limiting is deferred to F6, not blocking M2.
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

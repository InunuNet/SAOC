# D6 Door Check-in — Golden Reference

Feature: **D6** — `/admin/door` mobile-first QR scanner + `/api/admin/checkin` route for door check-in at the SAOC 2027 National Show.

Contract: `contracts/contract-d6-door-checkin.yaml`

---

## Behavioural contract

1. **Scan.** A door steward opens `/admin/door` on a phone. The camera scans an attendee's QR code. The QR encodes a `bookingRef`.
2. **Check in.** The page POSTs `{ bookingRef }` to `/api/admin/checkin`. The route looks the ticket up in Firestore by `bookingRef`, and if found and not already checked in, sets `checkedInAt: Timestamp.now()` and `status: 'checked-in'`.
3. **Feedback.** The page shows a clear **green success** (attendee name + ticket type) or **red failure** (ticket not found / already checked in / auth error).
4. **Fallback.** A manual text input lets the steward type a `bookingRef` and press Enter when the camera fails or the QR is damaged.
5. **Auth.** The route is gated by the **same** session-cookie + admin-claim check as D5. No new auth mechanism.

---

## File 1 — `app/admin/door/page.tsx` (client component)

- First line is `'use client'` — REQUIRED for browser camera access.
- Imports `Html5Qrcode` (or `Html5QrcodeScanner`) from `html5-qrcode`.
- On a successful scan, calls a `checkIn(bookingRef)` helper that does
  `fetch('/api/admin/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingRef }) })`.
- Renders a manual `<form>` / `<input>` fallback; submitting (Enter) calls the same `checkIn` helper.
- Holds result state and renders **success** (green) vs **error/failure** (red) feedback. Both literal strings `success` and one of `error`/`fail`/`red` must appear in the source.
- Mobile-first: full-width controls, large tap targets. No desktop-only assumptions.
- Debounce / lock during an in-flight request so one QR is not submitted repeatedly by the continuous scanner.

### Reference shape (illustrative — not verbatim)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type Result =
  | { kind: 'idle' }
  | { kind: 'success'; name: string; ticketType: string }
  | { kind: 'error'; message: string };

export default function DoorPage() {
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const busy = useRef(false);

  async function checkIn(bookingRef: string) {
    if (busy.current || !bookingRef) return;
    busy.current = true;
    try {
      const res = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ kind: 'success', name: data.ticket.attendeeName, ticketType: data.ticket.ticketType });
      } else {
        setResult({ kind: 'error', message: data.error ?? 'Check-in failed' });
      }
    } catch {
      setResult({ kind: 'error', message: 'Network error' });
    } finally {
      busy.current = false;
    }
  }

  // ... Html5Qrcode start/stop in useEffect, calling checkIn(decodedText) ...

  return (
    <main className="min-h-dvh p-4">
      <div id="qr-reader" className="w-full" />
      <form onSubmit={(e) => { e.preventDefault(); checkIn(/* input value */ ''); }}>
        <input name="bookingRef" placeholder="Enter booking reference" />
      </form>
      {result.kind === 'success' && (
        <div className="bg-green-600 text-white p-6">Checked in: {result.name}</div>
      )}
      {result.kind === 'error' && (
        <div className="bg-red-600 text-white p-6">{result.message}</div>
      )}
    </main>
  );
}
```

---

## File 2 — `app/api/admin/checkin/route.ts` (POST)

- Exports `async function POST(req: Request)`.
- **Auth — copy D5 exactly** (`app/api/admin/tickets/route.ts`):
  1. `const sessionCookie = (await cookies()).get('session')?.value;` → if missing, `401`.
  2. `await getAuth(initAdmin()).verifySessionCookie(sessionCookie, true)` in try/catch → on throw, `401`.
  3. `decodedToken.admin === true || decodedToken['role'] === 'admin'` → if false, `403`.
- Parse body `{ bookingRef }`. If absent/empty → `{ success: false, error: 'Missing bookingRef' }`.
- Look the ticket up:
  `db.collection('tickets').where('bookingRef', '==', bookingRef).limit(1).get()`.
  - Empty → `{ success: false, error: 'Ticket not found' }`.
  - `data.status === 'checked-in'` → `{ success: false, error: 'Already checked in' }`.
- Otherwise update: `doc.ref.update({ checkedInAt: Timestamp.now(), status: 'checked-in' })`.
- Return `{ success: true, ticket: { ...mapped Ticket } }`.

### Reference shape (illustrative — not verbatim)

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await getAuth(initAdmin()).verifySessionCookie(sessionCookie, true);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin =
    decodedToken.admin === true ||
    (decodedToken as Record<string, unknown>)['role'] === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { bookingRef } = (await req.json()) as { bookingRef?: string };
  if (!bookingRef) {
    return NextResponse.json({ success: false, error: 'Missing bookingRef' }, { status: 400 });
  }

  const db = getFirestore(initAdmin());
  const snap = await db.collection('tickets').where('bookingRef', '==', bookingRef).limit(1).get();
  if (snap.empty) {
    return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
  }

  const doc = snap.docs[0];
  const data = doc.data();
  if (data['status'] === 'checked-in') {
    return NextResponse.json({ success: false, error: 'Already checked in' }, { status: 409 });
  }

  await doc.ref.update({ checkedInAt: Timestamp.now(), status: 'checked-in' });

  return NextResponse.json({
    success: true,
    ticket: {
      id: doc.id,
      bookingRef: data['bookingRef'],
      attendeeName: data['attendeeName'],
      attendeeEmail: data['attendeeEmail'],
      ticketType: data['ticketType'],
      status: 'checked-in',
    },
  });
}
```

---

## File 3 — `package.json`

- Add `"html5-qrcode": "^2.3.8"` (latest 2.x) to `dependencies`. Run `pnpm install` so `pnpm-lock.yaml` updates.

---

## Type notes

- `types/index.ts` already defines `TicketStatus` **including** `'checked-in'` and the `Ticket.checkedInAt: Timestamp | null` field. No type changes required.
- Strict TS: no `any`; the one cast (`decodedToken as Record<string, unknown>`) mirrors D5 and is acceptable with the existing inline comment pattern.

## Out of scope for D6

- No new login page (reuse D5 `/admin/login`).
- No undo/un-checkin endpoint.
- No offline queue / PWA caching.
- No QR-code *generation* (that lives with ticket issuance, not the door).

## Definition of done

- All 18 functional assertions + both gates (`pnpm type-check`, `pnpm lint`) pass.
- Scanning a valid unused bookingRef shows green success; scanning an unknown or already-checked-in ref shows red failure.
- Unauthorized requests to `/api/admin/checkin` get 401 (no/invalid cookie) or 403 (valid cookie, non-admin).

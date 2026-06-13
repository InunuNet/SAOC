# D5 Admin Dashboard — Golden Reference

Feature: **D5** — `/admin` route with Firebase Auth + custom-claim gating, a read-only
ticket list table sourced from Firestore, and an attendee CSV export.

**Skeleton only.** No refund handler (waits on Stripe / D2). No ticket-creation UI.
Read-only admin view.

---

## Files to produce

| File | Type | Responsibility |
|------|------|----------------|
| `app/admin/page.tsx` | Server Component | Auth-gated ticket table |
| `app/admin/login/page.tsx` | Client Component | Firebase email/password sign-in |
| `app/api/admin/tickets/route.ts` | Route handler (GET) | Tickets collection as JSON |
| `app/api/admin/export-csv/route.ts` | Route handler (GET) | Tickets as `text/csv` download |

---

## Auth model

- Admin identity = a Firebase Auth user carrying a **`role: admin` custom claim**
  (the `admin` claim). Claims are set out-of-band (Admin SDK / console), not in this feature.
- Browser session is carried as a **Firebase Auth session cookie**.
- Server-side verification uses the Admin SDK:
  `getAuth(initAdmin()).verifySessionCookie(cookie, true)` → inspect `decoded.role === 'admin'`
  (or `decoded.admin === true`).
- `app/admin/page.tsx` (Server Component): read the session cookie via `next/headers`
  `cookies()`. If missing, invalid, or lacking the admin claim → `redirect('/admin/login')`.
- `app/admin/login/page.tsx`: `'use client'`. Calls
  `signInWithEmailAndPassword(auth, email, password)` against the client Firebase app
  from `lib/firebase.ts`. On success, establishes the session cookie (e.g. POST the
  ID token to a session endpoint) and navigates to `/admin`.
- Both API routes independently re-verify the admin claim from the session cookie and
  return **401** (no/invalid session) or **403** (authenticated but not admin) otherwise.

> Per-page + per-route checks are required. Middleware is acceptable as an *additional*
> layer but does not replace the server-side claim verification in each route/page,
> because middleware cannot run the Admin SDK on the Edge runtime.

---

## Data shape — `tickets` collection

Each ticket document is rendered with these six fields (table columns, in order):

| Column | Field | Notes |
|--------|-------|-------|
| Booking Ref | `bookingRef` | string |
| Attendee | `attendeeName` | string |
| Email | `attendeeEmail` | string |
| Type | `ticketType` | string |
| Status | `status` | string |
| Purchased | `purchasedAt` | Firestore Timestamp → format for display |

---

## `app/admin/page.tsx` (shape)

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

export default async function AdminPage() {
  initAdmin();
  const session = (await cookies()).get('session')?.value;
  if (!session) redirect('/admin/login');

  let decoded;
  try {
    decoded = await getAuth().verifySessionCookie(session, true);
  } catch {
    redirect('/admin/login');
  }
  if (decoded.role !== 'admin' && decoded.admin !== true) {
    redirect('/admin/login');
  }

  const snap = await getFirestore().collection('tickets').get();
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return (
    <table>
      <thead>
        <tr>
          <th>Booking Ref</th><th>Attendee</th><th>Email</th>
          <th>Type</th><th>Status</th><th>Purchased</th>
        </tr>
      </thead>
      <tbody>
        {/* one <tr> per ticket: bookingRef, attendeeName, attendeeEmail,
            ticketType, status, purchasedAt */}
      </tbody>
    </table>
  );
}
```

## `app/admin/login/page.tsx` (shape)

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
// import { auth } from '@/lib/firebase';  // client auth instance

export default function AdminLoginPage() {
  // email/password form → signInWithEmailAndPassword(auth, email, password)
  // → exchange ID token for a session cookie → router.push('/admin')
}
```

## `app/api/admin/tickets/route.ts` (shape)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  initAdmin();
  const session = request.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let decoded;
  try {
    decoded = await getAuth().verifySessionCookie(session, true);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (decoded.role !== 'admin' && decoded.admin !== true) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snap = await getFirestore().collection('tickets').get();
  return NextResponse.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
```

## `app/api/admin/export-csv/route.ts` (shape)

```ts
export async function GET(request: NextRequest) {
  // same admin-claim gate as tickets route (401 / 403)
  initAdmin();
  const snap = await getFirestore().collection('tickets').get();

  const header = 'bookingRef,attendeeName,attendeeEmail,ticketType,status,purchasedAt';
  const rows = snap.docs.map((d) => { /* CSV-escape each field */ });
  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="saoc-attendees.csv"',
    },
  });
}
```

---

## Scope boundary (MUST NOT ship in D5)

- ❌ No refund endpoint (`app/api/admin/refund/**`) — blocked on Stripe / D2.
- ❌ No ticket-creation / edit / delete UI — read-only view only.
- ❌ No write operations against the `tickets` collection.

---

## Acceptance gates

- `pnpm type-check` passes (strict TS, zero errors, no `any`).
- `pnpm lint` passes (zero errors).
- All four route files exist and pass the assertions in
  `contracts/contract-d5-admin-dashboard.yaml` (phase 1).

## Conventions

- Admin SDK only server-side (Server Component + route handlers). Never import
  `firebase-admin` into the client login page.
- Client login page is the only `'use client'` file in this feature.
- Conventional commit: `feat: D5 admin dashboard skeleton (auth-gated ticket table + CSV export)`.

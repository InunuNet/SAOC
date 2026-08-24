# F4 — Door Check-In Manual Protocol

## Overview

This protocol documents the manual steps to prove feature F4 (real door check-in scan) works end-to-end. The `/admin/door` surface cannot be tested with a service-account or unauthenticated path by design — it requires a real interactive Firebase Auth sign-in with `admin === true` custom claim, email-verified status, and live membership in the `ADMIN_EMAIL_ALLOWLIST` secret.

**Before starting:** confirm your email has both the admin claim AND is in the deployed allowlist (step 1, below). The script mints only the claim; the allowlist is a separate manual/infrastructure step.

---

## Prerequisites

### 1. Confirm admin identity (both claim and allowlist)

The admin gate (`lib/admin-auth.ts`) enforces three conditions simultaneously, all three every request:
- `admin === true` custom claim on the decoded token
- `email_verified === true` on that token
- Email is a live member of `ADMIN_EMAIL_ALLOWLIST` (checked at request time, not baked in)

**To grant the admin claim:**
```bash
pnpm exec tsx scripts/admin-grant.ts your-email@example.com [--existing]
```

- If this is your first admin account, the script will create it and print a password reset link.
- If you already have a Firebase account under this email, run with `--existing` after reviewing the account provenance (the script prints it).
- This grants the **claim only**. The email must separately be in the deployed `ADMIN_EMAIL_ALLOWLIST` secret. If it is not, all three of the gate's checks will fail on the deployed site.

**To verify the allowlist (requires access to Secret Manager):**

The `ADMIN_EMAIL_ALLOWLIST` is a comma-separated string in Google Cloud Secret Manager for the `saoc-prod` project. Your email must be there, trimmed and lower-cased.

If you added it yourself:
- The dev site reads this value from `.env.local` at startup (via Next.js config).
- The deployed site reads it from Secret Manager on every request.
- **Check which environment you're testing:** if testing locally, ensure your email is in `.env.local`'s `ADMIN_EMAIL_ALLOWLIST`. If testing on the deployed site, check Secret Manager in the Google Cloud console.

See `docs/admin-access.md` for the full debugging guide, including what each `reason` value means when the gate refuses you.

---

## The Test: Steps 1-4 (admission)

### Step 1: Sign in

1. Open the deployed site: **https://saoc-webapp-<staging>.web.app** (or local dev at http://localhost:3000)
2. Navigate to `/admin/login`
3. Sign in with your email using Firebase Auth (email/password, Google, Microsoft, or Apple depending on what's provisioned)
4. After sign-in completes, your browser will navigate to `/admin` (the admin home page)

### Step 2: Open the door scanner

1. From the admin home page, navigate to `/admin/door` (or click the "Door Check-in" link if one is present)
2. The page attempts to access your device's camera. Allow camera access when prompted.
3. If camera access fails or is denied, manual entry (step 4) is the acceptable fallback.

### Step 3: Obtain a real paid booking reference

Use one of the following **real, paid bookings** that are already in Firestore:

- **`SAOC-2027-5DEFEKCF6S1R`** (primary test ref — used in examples below)
- **`SAOC-2027-X8ZPQNYCVWGY`** (alternate)
- **`SAOC-2027-EM1BPQJTAN7Y`** (Brad's own purchase — alternate)

These are real orders with `status: 'paid'` in the `tickets` collection, belonging to the 2027 National Show.

**If you have a confirmation email with a QR code:** scanning it is the better test because it exercises the real attendee path — the QR encodes the booking reference as plain text, and `lib/checkin.ts` decodes it via `html5-qrcode`. Either way (scanned or manually entered), the code path is identical.

### Step 4: Submit the booking reference

**Option A — Camera scan (preferred):**
- Position your device's camera over the QR code in your confirmation email
- The scanner will decode it automatically and POST to `/api/admin/checkin`
- The result appears instantly on the page

**Option B — Manual entry:**
- If the camera is unavailable or fails, type or paste the booking reference into the "Manual entry" text field
- Click "Check In"
- The same `/api/admin/checkin` POST is sent; the code path is identical to a scanned QR

### Step 5: Confirm successful admission

The door page will display a green success banner with:
- `success: true`
- The ticket details: attendee name, email, ticket type, etc.

This confirms:
1. `POST /api/admin/checkin` succeeded (HTTP 200)
2. The order's `status` is now `'checked-in'` in Firestore
3. A `checkinAttempts` audit record was written with `outcome: 'admit'` and your `scannedByUid`

---

## Success Feedback Overlay — Design and Implementation

### What you see

When a check-in succeeds (step 5 above), the result banner renders as a **full-viewport overlay** — it fills the entire screen, not a small card or banner. The overlay:

- **Success state:** solid sage-green background (`bg-primary`), large checkmark icon, attendee name in bold, ticket type and booking reference below. The overlay **auto-dismisses after 3 seconds**, returning to the live camera view ready for the next attendee.
- **Failure state:** solid cream background (`bg-bone`), border and text in dark sage (`primary-800`), large ✕ icon, and the specific refusal reason (e.g., "Already checked in", "Unpaid", "Not found"). The failure overlay **persists until the next scan**, giving the steward time to read and decide what to do.

### Why an overlay (root cause and fix)

**The problem:** before this fix, the success and failure banners were appended to the bottom of the page's normal document flow, after:
- the page header (~70px)
- the live camera scanner box (300-400px, depending on device aspect ratio and the QR library's letterboxing)
- a torch button for low-light scanning (~50px)
- the manual-entry form (label + input/button ~130px)

This positioned the banner **below the fold** at typical mobile viewports (320px–375px height). The result rendered correctly and persisted correctly — it was purely a layout problem: a below-the-fold element that the operator never scrolled down to see is functionally the same defect as one that never renders at all.

**The fix:** the banner now renders as a `position: fixed` full-viewport overlay (`inset: 0`, using `dvh` for mobile viewport-height correctness). This guarantees visibility regardless of how tall the content above it is or where the user has scrolled. The overlay is rendered conditionally the same way (`result && <Overlay .../>`), just positioned differently.

**Key lesson for mobile admin tools:** any result, confirmation, or error UI must be verified against the **actual viewport height of your target device**, not just "does it render in the DOM." A correctly-rendering element below the fold is invisible to the user — measure twice, render to the viewport.

### Visual design (reusing existing tokens)

The overlay uses only existing design tokens from this project:
- **Success background:** `bg-primary` (the sage green already established as the site's primary brand color)
- **Success text:** `text-ivory` (the established light text color)
- **Failure background:** `bg-bone` (the established light neutral)
- **Failure border/text:** `primary-800` (dark sage, already in use as an accessible-contrast pair with `bg-bone` elsewhere in the site)

No new brand colors were invented for this fix — the palette reuses the existing precedent.

For full implementation details and the decision record, see `contracts/golden/door-checkin-success-feedback-f1/README.md`.

---

## The Test: Step 6 (duplicate refusal)

### Repeat the same booking reference immediately

1. **In the same browser session**, enter the same booking reference again (either by scanning the QR again or typing it)
2. Click "Check In"

**Expected result:** a red error banner with:
- `success: false`
- `error: "Already checked in"` (HTTP 409)

This proves the admission rule (`lib/checkin.ts:admit()`) actually runs on the second attempt, not just on the happy path:
- It checks `if (status === 'checked-in') return refuse('already-checked-in')`
- This refusal is returned **before** the paid-status check, because a checked-in ticket is no longer 'paid' and door staff must be told what actually happened

---

## Verification: Firestore State

After step 5 (successful admission), query Firestore directly:

```
Collection: tickets
Document: SAOC-2027-5DEFEKCF6S1R (or whichever ref you used)
Expected fields:
  - status: "checked-in"
  - checkedInAt: <Timestamp of when you scanned>
```

After step 6 (duplicate refusal), verify the position is still `'checked-in'` (never changed):

```
Collection: tickets
Document: SAOC-2027-5DEFEKCF6S1R
Expected:
  - status: "checked-in" (unchanged from step 5)
  - checkedInAt: (same timestamp, not updated by the second scan)
```

---

## Verification: Audit Trail

`lib/checkin-audit.ts` creates an append-only `checkinAttempts` collection. Every attempt (admitted or refused) produces one record.

### After step 5 — successful admission:

```
Collection: checkinAttempts
Query: where bookingRef == "SAOC-2027-5DEFEKCF6S1R"
Expected: at least one document with:
  - outcome: "admit"
  - bookingRef: "SAOC-2027-5DEFEKCF6S1R"
  - showId: "2027-national-show" (the NATIONAL_SHOW_ID constant)
  - scannedByUid: <your Firebase UID>
  - scannedAt: <timestamp of the scan>
  - refusalReason: null (outcome === 'admit' forces refusalReason to null)
```

### After step 6 — duplicate refusal:

```
Collection: checkinAttempts
Query: where bookingRef == "SAOC-2027-5DEFEKCF6S1R"
Expected: at least TWO documents:
  1. outcome: "admit" (from step 5)
  2. outcome: "already-checked-in" (from step 6's second submission)
```

The second record must have a `scannedAt` timestamp **after** the first one, proving it's a genuinely later attempt.

---

## Automated Verification Commands

After completing steps 1–6 above, run these commands to prove the feature works:

### A9: Verify the audit trail exists (prove step 5 worked)

```bash
python3 execution/checks/verify_checkin_audit.py --booking-ref SAOC-2027-5DEFEKCF6S1R
```

**What it checks:**
- At least one `checkinAttempts` document exists for this booking reference
- That document has `outcome === 'admit'` (not a refusal audit trail)
- The document has a non-empty `scannedByUid` (proves a real interactive Firebase Auth session did the scan, not a synthetic/unauthenticated write)

**Success output:**
```
OK: checkinAttempts document exists for bookingRef='SAOC-2027-5DEFEKCF6S1R' with outcome='admit', scannedByUid='<your-uid>', scannedAt='<timestamp>'
```

**Exit code:** 0 = pass, 1 = fail (no admit record, or only refusal records), 2 = setup error

### A10: Verify duplicate attempts are refused, not re-admitted (prove step 6 worked)

```bash
python3 execution/checks/verify_checkin_duplicate_refused.py --booking-ref SAOC-2027-5DEFEKCF6S1R
```

**What it checks:**
- The position's `status` is exactly `'checked-in'` (not a different state)
- Exactly **one** `checkinAttempts` record exists with `outcome === 'admit'` (not zero, not multiple)
- At least one `checkinAttempts` record exists with `outcome === 'already-checked-in'` and a `scannedAt` **after** the admit record's timestamp

**Success output:**
```
OK: position tickets/SAOC-2027-5DEFEKCF6S1R is 'checked-in'; exactly one 'admit' record exists (scannedAt='<time1>'); a later 'already-checked-in' record exists (scannedAt='<time2>', scannedByUid='<uid>') — the duplicate submission was made, recorded, and correctly refused, not re-admitted.
```

**Exit code:** 0 = pass, 1 = fail (position not checked-in, no admit record, multiple admits, or no later refusal), 2 = setup error

---

## Full Contract Gate

After both A9 and A10 pass, run the full feature gate:

```bash
MISSION_F2_BOOKING_REF=SAOC-2027-5DEFEKCF6S1R python3 execution/contract.py gate --phase all \
  --run-checks .agent/memory/project/specs/prove-ticket-purchase-works-end-to-end-b/contract-f1.yaml
```

This runs all ten assertions (A1–A10) for the entire mission. Currently 8/10 assertions pass; A9 and A10 are pending exactly this manual test.

**Expected result when all features pass:** gate shows 10/10 green.

---

## Code Details: How It Works

### The door page (`app/admin/door/page.tsx`)

- Uses `html5-qrcode` library to decode QR codes from the device camera
- Decodes to plain text (the booking reference, e.g., `SAOC-2027-5DEFEKCF6S1R`)
- Manual entry field accepts the same text directly
- Both paths POST to `/api/admin/checkin` with `{ bookingRef: <string> }`

### The admission decision (`lib/checkin.ts:admit()`)

Runs inside a Firestore transaction. For a given booking reference:

1. Look up the ticket in the `tickets` collection by `where('bookingRef', '==', ...)`
2. If not found → refuse `'not-found'` (HTTP 404)
3. If `showId !== NATIONAL_SHOW_ID` (belongs to a different show) → refuse `'wrong-show'` (HTTP 403)
4. **If `status === 'checked-in'` → refuse `'already-checked-in'` (HTTP 409)** ← this is checked BEFORE paid
5. If `status !== 'paid'` → refuse `'unpaid'` (HTTP 403)
6. Otherwise: write `{ status: 'checked-in', checkedInAt: Timestamp.now() }` to the ticket and return success

The check at step 4 is deliberately ordered first so door staff are told what actually happened ("already checked in") rather than "unpaid" (which would be true of a checked-in ticket, but wrong to display).

### The API route (`app/api/admin/checkin/route.ts`)

1. Calls `getAdminSession()` — if it fails, returns 401 or 403 before reading/writing Firestore
2. Parses the request body; if parsing fails, logs error and audits `'malformed'`, then returns HTTP 400
3. Calls `checkInByBookingRef()` from `lib/checkin.ts`
4. If check-in throws (e.g., Firestore outage mid-transaction), logs error, audits `'infra-error'`, returns HTTP 500
5. If check-in returns a refusal (step 2–5 above), audits the refusal code (mapped to audit outcome), returns the refusal HTTP status
6. If check-in succeeds, audits `'admit'` with `scannedByUid` (your Firebase UID), returns `{ success: true, ticket: ... }`

### The audit record (`lib/checkin-audit.ts`)

Every POST to `/api/admin/checkin` produces one `checkinAttempts` document (append-only, never updated or deleted):

- `bookingRef`: the parsed request value (or null if parsing failed)
- `showId`: NATIONAL_SHOW_ID if the ticket was resolved, null if parsing/lookup failed
- `orderId`: the order ID if the ticket was resolved, null otherwise
- `outcome`: one of `'admit'`, `'not-found'`, `'wrong-show'`, `'unpaid'`, `'already-checked-in'`, `'malformed'`, or `'infra-error'`
- `refusalReason`: the HTTP error message (or null if outcome is `'admit'`)
- `scannedByUid`: your Firebase UID (proves a real authenticated session, not synthetic)
- `scannedAt`: timestamp of the attempt
- `source`: `'online'` (door scanner live submissions; not offline-queued batches)

---

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Sign-in page rejects email/password | Email not in Firebase project or password wrong | Use the password reset flow or check you're using the right project |
| After sign-in, browser goes to `/admin/login` again | `admin` claim not set or email not in `ADMIN_EMAIL_ALLOWLIST` | Run `scripts/admin-grant.ts` and check Secret Manager / `.env.local` |
| `/admin/door` shows 403 Forbidden | Session gate failed: see `docs/admin-access.md` for the `reason` values | Review the three-part gate: claim, email_verified, and allowlist membership |
| Camera permission denied | Browser is blocking camera access | Allow camera in browser settings, or use manual entry |
| Manual entry POSTs but no response | Network error or route crashed | Check browser console for errors; verify Firebase is reachable |
| POST succeeds but shows "Already checked in" on first attempt | Booking reference was already admitted in a prior scan or session | Use one of the alternate refs listed above, or use a new purchase |
| "Ticket not found" on a booking reference | Reference doesn't exist in Firestore, or was typo'd | Double-check the reference, or use one of the provided alternates |
| A9 or A10 scripts fail with "SETUP FAILURE" | Firestore REST API setup failed (auth, credentials, etc.) | Check `execution/checks/_firestore_rest.py` configuration and Firestore access |

---

## Alternate Booking References

If `SAOC-2027-5DEFEKCF6S1R` has already been used or consumed:

- **`SAOC-2027-X8ZPQNYCVWGY`** — real, paid, in Firestore
- **`SAOC-2027-EM1BPQJTAN7Y`** — real, paid, Brad's own purchase

All three are belonging to the 2027 National Show (`showId: '2027-national-show'`) and have `status: 'paid'` in the `tickets` collection.

For the contract gate, substitute the booking reference in the environment variable:
```bash
MISSION_F2_BOOKING_REF=SAOC-2027-X8ZPQNYCVWGY python3 execution/contract.py gate ...
```

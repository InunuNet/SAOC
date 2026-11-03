# Door Test-Ticket QR Seeder

**Contract:** `contracts/contract-door-test-qr-seeder.yaml` .

**Status:** Unblocks mission `admin-auth-hardening` F6. Test data seeding is complete and idempotent. The door admission logic itself is proven end to end in [ticketing-hardening.md](ticketing-hardening.md) F1; this tool provides the QR-code test vectors.

---

## How It Works

The QR payload is just the plain booking-reference string — `app/admin/door/page.tsx` passes decoded text straight to `POST /api/admin/checkin` as `bookingRef`. No PayFast involvement; fixtures are seeded directly via the Admin SDK.

**Two commands:**

```bash
pnpm door:seed      # Create test tickets and output QR sheet
pnpm door:teardown  # Delete test tickets (idempotent)
```

**Output:** `scripts/output/door-test-qr/sheet.html` (gitignored) — printable QR codes for each fixed reference.

Seed is idempotent — re-running `pnpm door:seed` resets all ticket states to the baseline.

---

## Test Vectors

Four fixed booking references prove five outcomes:

| Reference | Status | Scan Result | Notes |
|-----------|--------|-------------|-------|
| `DOOR-QR-ADMIT-01` | paid | 200 admit, then 409 on rescan | Anti-passback: already checked in |
| `DOOR-QR-UNPAID-01` | reserved | 403 unpaid | Ticket not yet paid |
| `DOOR-QR-WRONGSHOW-01` | paid | 403 wrong-show | Ticket belongs to different show |
| `DOOR-QR-MISSING-01` | — | 404 not found | No document exists |

**Not covered:** `bad-request` is deliberately out of scope (not encodable as a scanned QR).

---

## Live-project guard

`pnpm door:seed` refuses to run against the live Firebase project `saoc-webapp`. It checks `FIREBASE_ADMIN_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` and the service-account email, and fails closed when the admin project id is unset or blank. There is no flag or env override. The refusal happens before any credential is parsed or any write is attempted, and the same guard sits inside `seedFixtureDoc`. With only the live project configured, `seed` cannot run; a separate fixture project or the emulator is required.

`pnpm door:teardown` is not gated. It deletes only the three exact fixture booking references, so it can clean earlier residue from any project.

Fixtures use ticket type `door-qr-fixture` (not `exhibitor`), so they cannot be counted against a real product. The reserved fixture is seeded with `expiresAt` 60 seconds before seed time, so it is never a live hold. The legacy live-write contract assertions (A2-A5) were retired; offline checks live in `contracts/checks/go-live-f6/`.

---

## Integration with Admin Access

The door scanner (`/admin/door`) is part of the Firebase Auth-gated admin surface. See [docs/admin-access.md](admin-access.md) for authentication and authorization details.

---

## Related

- [Ticketing Hardening](ticketing-hardening.md) — F1 covers door admission logic end to end
- [Ticketing](ticketing.md) — payment flow and ticket model context
- [Admin Access](admin-access.md) — authentication for `/admin` routes

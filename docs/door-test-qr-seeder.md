# Door Test-Ticket QR Seeder

**Contract:** `contracts/contract-door-test-qr-seeder.yaml` (6/7). A5 is RED for environmental reasons.

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

## Known Issues

### A5 — Environmental RED (not a defect)

A5 requires the entire live `tickets` collection to be residue-free before the seeder can pass. Currently, ~15 pre-existing `@harden-check.invalid` documents (fixture residue from earlier test runs) remain. This blocks A5 only — A1–A4 are green.

**Remedy:** Delete the pre-existing residue documents from Firestore, then A5 will pass. This is Brad's call, not automated.

---

## Integration with Admin Access

The door scanner (`/admin/door`) is part of the Firebase Auth-gated admin surface. See [docs/admin-access.md](admin-access.md) for authentication and authorization details.

---

## Related

- [Ticketing Hardening](ticketing-hardening.md) — F1 covers door admission logic end to end
- [Ticketing](ticketing.md) — payment flow and ticket model context
- [Admin Access](admin-access.md) — authentication for `/admin` routes

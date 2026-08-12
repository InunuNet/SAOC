# Golden files — ticketing-hardening

These files are the specification @dev implements against. They are authored by
@architect and must not be edited by @dev. Where a golden states a rule, the matching
assertion in `contracts/contract-ticketing-hardening.yaml` proves that rule by
BEHAVIOUR — a real HTTP round-trip, a real concurrent-request race, or a real Firestore
read-back — not by grepping source.

| File | What it pins |
|------|--------------|
| `checkin-admission-rules.golden.md` | The complete door-admission decision table and the required module boundary |
| `capacity-transaction.golden.md` | What "no oversell" means operationally and the required transaction shape |
| `idempotency-and-booking-ref.golden.md` | The `Idempotency-Key` contract and the booking-reference format |
| `booking-ref-format.golden.txt` | The exact regex a booking reference must match (and the one it must NOT) |
| `apphosting-site-url.golden.yaml` | The exact `SITE_URL` block to add to `apphosting.yaml` |
| `itn-route.golden.sha256` | sha256 of `app/api/tickets/itn/route.ts` at contract-authoring time — the ITN webhook is a verified security boundary and must not drift |

## Why grep assertions are almost absent from this contract

The previous session's contract produced three false greens from source greps: a comment
matched the pattern it was meant to detect, and a `"sold out"` string match passed while
server-side capacity enforcement did not exist at all. In this contract, greps are used
only for structural/config facts that have no runtime surface in the gate environment
(`SITE_URL` in `apphosting.yaml`, the ITN hash pin, the no-secret-logging rule).

## Known environment constraint — Firebase Auth is NOT provisioned

Verified 2026-08-11 against the real project: `getAuth().listUsers()` and
`createUser()` both fail with `auth/configuration-not-found`. Firebase Authentication has
never been enabled on `saoc-webapp`, so **no ID token can be minted and no admin session
cookie can exist** — the `/admin` login and the door scanner are non-functional in every
environment today, independently of any defect in this contract.

Consequence for verification: the door-admission rules cannot be proved through an
authenticated HTTP round-trip. They are instead proved by calling the extracted
`lib/checkin.ts` service directly against **real Firestore** (real writes, real read-back,
real concurrency) — the full decision and persistence path, with only the cookie-parsing
layer skipped. That layer is separately covered by an unauthenticated HTTP check
(401, and no ticket mutated), which needs no credentials and runs today.

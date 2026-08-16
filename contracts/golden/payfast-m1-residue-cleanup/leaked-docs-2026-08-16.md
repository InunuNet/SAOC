# Known residue — payfast-m1 gate run, 2026-08-16

Reported by Brad, confirmed live in the `tickets` collection. Running
`contract-payfast-m1.yaml`'s gate on 2026-08-16 created 7 documents that were
never removed. `tickets` went from 5 documents to 12; these 7 are the new
ones, all created during that gate run:

| Timestamp (UTC) | Doc ID | attendeeName |
|---|---|---|
| 2026-08-16T14:07:27Z | `CrF2gcbRQCMPGRKSn8Da` | `Proof` |
| 2026-08-16T14:07:29Z | `MbnMi9tAL7WiFXTMKufc` | `Proof` |
| 2026-08-16T14:07:31Z | `HorxzPqpPWfo7sw1w3Hx` | `Proof` |
| 2026-08-16T14:07:32Z | `diLuP0fkUEXhv9P2f21D` | `Proof` |
| 2026-08-16T14:07:34Z | `kPxuUXcKF8jTw0IczYI4` | `Proof` |
| 2026-08-16T14:09:37Z | `OXauVpRMw6CX2bPeYjrY` | `Proof` |
| 2026-08-16T14:09:40Z | `W7yyX5eB63WYKxspuR5I` | `Proof` |

## Why the code review in this contract does not explain their origin

Every Firestore-mutating script currently committed under
`contracts/checks/payfast-m1/` (`check-itn-amount-tamper-rejected.mts`,
`check-itn-server-confirm-and-status-gating.mts`,
`check-itn-atomic-idempotent-write.mts`,
`check-itn-source-ip-validation.mts`) already routes ticket creation through
`contracts/checks/ticketing-hardening/_shared.mjs`'s `createTicketDoc()`,
which refuses to write a document without a `@harden-check.invalid`
`attendeeEmail` and stamps `attendeeName: 'Harden Check'`, and each of the
four scripts already wraps its body in `shared.withCleanup()`. `git log --all
-p` and a full-repo `grep -rl "Proof"` (outside this catalogue and an
unrelated `admin-auth-f4-google` fixture) turn up no committed source that
ever set `attendeeName: 'Proof'`. The most likely explanation is that these 7
documents were written by a now-superseded version of the payfast-m1 checks
(this repo's `f87bcb3`, "prove ITN validation by behaviour and AST, not
grep", rewrote this suite the same day) or by an uncommitted local script —
not by the code as it stands today. This is a factual gap, not a rationalized
excuse: report it as unresolved, do not invent a tidy story to close it.

## Disposition

**Do NOT delete these 7 documents, or the 5 pre-existing ones (12 total).**
Deletion against the live database is Brad's call; he has not made it. This
is detect-and-report only, following the same policy already established in
`contracts/golden/firestore-residue-guard/marker-catalogue.md` for the four
`SAOC-2027-*` diagnostic booking refs from 2026-08-12.

They are added to `scripts/scan-firestore-residue.ts` as a literal
`KNOWN_RESIDUE_DOC_IDS` allowlist (matched against the Firestore document ID
itself, since none of the 7 carry a marker-shaped `bookingRef` — see
`fieldPath: 'id'` in the scanner's `walk()`). This is why the residue-guard
scanner's hit count is EXPECTED to rise from 12 to 19 once this contract
ships (12 pre-existing hits + 7 newly-detectable). **A rising hit count here
is success, not a regression** — it means the scanner started seeing
documents it was previously blind to. An unchanged hit count would mean the
opposite: the scanner still cannot see them.

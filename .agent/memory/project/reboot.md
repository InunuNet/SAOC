# Reboot Context
_Written 2026-08-12 05:32 local, during the overnight resume session (relaunched 03:11 by the
one-shot crontab, which has since self-evicted — there is no further scheduled relaunch)._

## ⚡ STATE AT A GLANCE

| Stream | Contract | Gate | QA | Docs | Committed |
|---|---|---|---|---|---|
| A — ticketing hardening | `contract-ticketing-hardening.yaml` | **37/37 ×2 runs** | round 1 done; **round 2 verdict never arrived** | done | NO |
| B — show-visitor-info | `contract-show-visitor-info.yaml` | 71/72, confirming run in flight | FAIL→fixed, **not re-reviewed** | in progress | NO |
| C — CMS wiring cleanup | `contract-cms-wiring-cleanup.yaml` | 14/14 | PASS | done | NO |
| D — show-exhibitor-info | `contract-show-exhibitor-info.yaml` | **52/52** | FAIL→fixed, **not re-reviewed** | done | NO |

**NOTHING IS COMMITTED.** ~100 dirty paths. Last commit `d1e11df`. That is the single largest
risk in the tree — larger than any remaining defect. Commit before starting new work.

## Standing constraints (each has been violated at least once)
- **Dev server on port 3333**, shared. Do not kill/restart.
- **Never gate a stream while its agents are working.** Produced phantom failures repeatedly:
  `pnpm build` catches mid-edit, and mutating checks collide on the dataset lock and report an
  ordinary FAIL indistinguishable from a real defect.
- **Assert behaviour, never source greps**, for anything security-, money- or content-truth
  relevant. See "The lesson".
- **`app/api/tickets/itn/route.ts` is hash-pinned** at
  `7c96726ab4bba28ec8ef027dd7747c39358d23bb27ca1dcac4328201df3b4d0f`. It was edited exactly once,
  under specific authorisation, with the decision + old/new hashes recorded in
  `contracts/golden/ticketing-hardening/itn-write-guard.golden.md`. That authorisation is spent.
  @dev never re-pins a golden.
- Seed create-if-absent only; never `createOrReplace`. `scripts/seed-page-singletons.ts` still
  has that bug (7 occurrences) — untouched, still open.
- Keep scratch/probe files OUT of the repo tree; an in-repo probe fails `pnpm lint`, an assertion
  in every contract, and false-failed three streams once tonight.
- Never print or log secrets. No new brand assets/colours/fonts.

## What shipped

**A — ticketing security hardening (37 assertions).** Round 1 closed four confirmed defects: door
scanner admitting unpaid/wrong-show tickets (logic extracted to `lib/checkin.ts`, route delegates);
capacity TOCTOU (Firestore transaction; QA pushed 20-way concurrency at the boundary → exactly
1×201/19×409); booking refs from guessable 6-digit to 60-bit crypto-random; `SITE_URL` in
`apphosting.yaml`. Round 2 closed five defects QA found *past* a green gate — including **a
regression this work introduced**: making reservations authoritative against capacity was right,
but with no release path, cart abandonment would have sold the show out with zero revenue. Now a
TTL with a guard that a paid ticket can never be expired. Also: idempotency key bound to buyer and
payload (Bob replaying Alice's key previously got Alice's booking reference — the door code);
capacity fail-open on a *string* capacity; a late ITN retry resurrecting a checked-in ticket so the
same ref opened the door twice. Docs: `docs/ticketing-hardening.md`, plus corrections to
`docs/ticketing.md` and `docs/payfast-integration.md`.

**B — show-visitor-info (72 assertions).** Three visitor pages + show-identity wiring. Before this,
`/national-show` never read its `nationalShow` singleton — venue/dates/edition/countdown were
hardcoded JSX. A61 now swaps the whole show identity at runtime and sweeps seven surfaces; @dev
also proved the swap independently under a lock. Confirmation markers were fixed twice: they had an
off switch (clearing one unvalidated `pendingLabel` removed all 23 markers while every status still
said `pending`), and the 14 FAQ markers were invisible inside collapsed `<details>`.

**C — CMS wiring cleanup (14 assertions).** Complete. `award` was already wired (backlog entry was
stale). `province` wired not removed (9 live docs); chips verified to actually filter via Playwright.
Two dead fields removed after live `defined()` count 0. Docs: `docs/cms-wiring-cleanup.md`,
`docs/provinces-for-editors.md`.

**D — show-exhibitor-info (52 assertions).** Exhibitor guide built on researched international
convention, clearly marked as pending committee confirmation. Docs: `docs/show-exhibitor-info.md`,
`docs/exhibitor-guide-for-editors.md`.

## The lesson (for learned.md)

**Assertions that source their expected value from the same place as the actual value cannot fail.**
Every stream demonstrated it: A54 grepped source for a venue literal that lived in Sanity → green
while the page rendered two different venues in one viewport. A43 looked for the pending-marker
label by reading that label from the dataset → clearing the label made the needle empty and the
check short-circuited green. A11 proved booking-ref format+uniqueness, not entropy → a sequential
counter passed. A14's negative grep missed `status !== "paid"` (wrong operator, wrong quote style).
A35 failed in the opposite direction — a substring match on single-letter class codes could never
pass. A33 scanned an enumerated field list and never saw step bodies; the repair walks every string
recursively, which is the general form of the fix.

**Countermeasure that worked:** run every new assertion against the unfixed tree and record
red/green BEFORE @dev starts. That caught two worthless assertions on Stream A before they banked a
false green.

**Second lesson:** four separate files carried comments claiming they "fail closed" while the code
failed open (`ConfirmationBadge.tsx`, `ticketType.ts`'s capacity description, `itn/route.ts`'s
guard, `check-capacity-no-oversell.mjs`'s sweep claim). Treat a fail-closed claim in a comment as
an assertion to test, not a fact.

**Third:** the gate itself corrupted the live dataset three times. Mutating round-trip checks
declared no `timeout_seconds`, inherited the 60s default, and were SIGKILLed mid-mutation — after
the sentinel write, before the restore. SIGKILL is uncatchable, so a SIGTERM handler does not cover
it; only the timeout prevents it. All such checks now carry real timeouts, and the lock guard reaps
dead-pid locks. Dataset verified clean.

## Outstanding

- **A: round-2 QA verdict never arrived.** The new security code (reservation TTL, buyer-bound
  idempotency, capacity/price validation, ITN write guard) is gate-green but never adversarially
  reviewed. Round 1's equivalent found five real defects past a green gate. **Highest-value
  remaining work.** Specific questions: can the expiry sweep ever touch a paid ticket; what happens
  when an ITN arrives for a reservation the sweep already expired; did round 2 introduce its own
  second-order regression the way round 1 did.
- **B and D: round-2 fixes verified by gate but not re-reviewed by QA.**
- **`nationalShow.exhibitorStages` retirement is blocked** — a cross-contract deadlock: B's own A5
  asserts the field must exist, so deleting it turns B's gate red. Field holds zero content and is
  guarded by A51. Deferred deliberately; needs both contracts moved together.
- **B's A41/A56/A24 rotate red by gate ordering** — single-fetch rendered checks adjacent to
  mutating checks eat the one stale CDN copy served after a restore. @dev measured that one warm
  fetch suffices. Fix belongs in the shared helper, not per-assertion.
- **Harness bug to file upstream (InunuNet/Athanor):** `contract.py:473` drops the CLI-level
  `--timeout-seconds` override for sub-phases under `--phase all`. Per-assertion `timeout_seconds`
  DO survive (`contract.py:137-138`) — an earlier report claiming otherwise was wrong and is
  corrected in needs-human.md.
- `.agent/memory/scratch/gate-blocked-20260812T031704Z.md` — the Athanor pulse `qa -> docs` handoff
  froze itself after 3 failures. Did not block this session (agents dispatched directly).

## For Brad (also in needs-human.md)
- **Firebase Auth is NOT provisioned on `saoc-webapp`** — `listUsers()`/`createUser()` fail
  `auth/configuration-not-found`. `/admin` and the door scanner are non-functional in EVERY
  environment today, regardless of tonight's fixes. Blocks any door-scanning demo.
- No SAOC-side notification exists for contact-form enquiries — staff only see them in Firestore.
- Committee still owes: real ticket prices and capacity, confirmed venue and dates, opening hours,
  parking, accessibility, photography policy, cloakroom, accommodation, emergency contacts, and all
  exhibitor rules (entry deadline, fees, staging times, ownership rule, sales terms, entry form).

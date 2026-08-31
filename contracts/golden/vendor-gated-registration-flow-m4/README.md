# Golden: vendor-gated-registration-flow — M4 decision record

Mission `vendor-gated-registration-flow`, M4 (human-readable vendor registration code). Full
milestone/feature breakdown lives in `contracts/contract-vendor-gated-registration-flow.yaml`
(features F22-F25). This README is the decision record @dev implements against; @dev may not
deviate from a decision recorded here without flagging it back to the orchestrator. M1's own
decision record (application/review/token flow) is
`contracts/golden/vendor-gated-registration-flow-f1/README.md`; M2's is
`contracts/golden/vendor-gated-registration-flow-m2/README.md`. Both are unrelated to M4's
scope — do not confuse.

## Why now

Brad (2026-08-31, paraphrased): the M1 HMAC token — long, opaque, base64-ish — is unusable by
vendors, registrars and council members who have to read it aloud over the phone or retype it
from a forwarded email. Required format: **the vendor's business name, then a dash or
underscore, then a 4-digit code** — e.g. `FynbosPottery-4821`. This is a settled decision, not
reopened here. (The example above elides spaces only as informal shorthand for "a dash
separates the name from the code" — see "Format" below for the corrected, as-typed reading
that actually shipped.)

## The engineering problem: 4 digits is not, by itself, a barrier

10,000 possibilities and a semi-public business name (Lee-Ann invites vendors publicly;
business names surface on the showcase page) means the code cannot be the sole gate.
Everything below exists to make a 4-digit code safe **by construction** — never surfaced to
Brad as a tradeoff, because security is a standing condition on this project, not his call to
weigh.

## POPIA finding — read before assuming the worst case

Checked whether the full registration form prefills from the `VendorApplication` record.
It does not: `components/vendors/VendorRegisterForm.tsx`'s `INITIAL_STATE`
(`lib/vendor-register-form-payload.ts`) starts every field — `businessName`,
`contactPersonName`, `contactEmail`, `contactCellPhone`, everything — blank. A guessed code
does not hand an attacker any vendor's personal information via prefill. Two things F22-F25
must still guarantee, or this finding stops being true:

1. The new verify-code response (F23) returns **only** an opaque session artifact plus a
   success/failure boolean — never any `VendorApplication` field (`businessName`,
   `contactEmail`, `contactCellPhone`, `indicativeBoothCount`, etc.) in the JSON body, on
   success or failure. A5/A-equivalent below proves this by asserting the success response
   shape is exactly `{ ok: true }` (plus the session artifact delivered via cookie/redirect,
   never body JSON) and the failure shape is exactly the one generic message.
2. The real, un-mitigated harm of a successful guess is **not** PII disclosure — it is that
   the attacker can consume the real vendor's single-use code and submit a bogus full
   registration, locking the legitimate vendor out of their own approved slot (the existing
   single-use claim in `lib/vendor-registration-token-claim.ts` still only allows ONE
   successful submission per application). That is a business-integrity harm, and it is
   exactly what the lockout in F22 defends against.

## Format, and what stays literal vs. what's an entry-UI decision

CORRECTED 2026-09-01 (architect review pass, post-@dev flag): this section previously read
`{BusinessNameNoSpaces}-{4 digits}` (e.g. `FynbosPottery-4821`), which contradicted "Also
specified" below. As-typed is correct and is what shipped — resolved in favour of as-typed,
not the no-spaces slug, per Brad's actual requirement: a human reads this aloud down a phone
line, and the business name as the vendor typed it (`"Fynbos Pottery-4821"`) is what a vendor
recognises, not a slug they never saw. The **display** format is: `{businessName as typed}-{4
digits}`, e.g. `Fynbos Pottery-4821`. This is what appears in the approval email and the admin
table — never deviated from.

Normalisation (see "Name normalisation" below) still governs **matching only** — a vendor
typing the no-space/slug form (`FynbosPottery`), a different case, or different punctuation
must still normalise to the same slug and get in. Normalisation is never applied to what is
*displayed* back to a human.

The **entry UI** (F23) is two separate fields — a business-name text input and a 4-digit code
input (`inputmode="numeric"`, `maxLength=4`) — not one free-text field parsed by splitting on
the last `-`/`_`. Business names can legitimately contain hyphens (`"Cape-Town Orchids"`),
which makes splitting a single string ambiguous and a needless bug surface. This is a UI/
transport decision, not a deviation from Brad's format — the format he specified is a *display*
convention, and the two fields are joined and displayed exactly that way everywhere a human
reads it (email, admin table). The emailed convenience link still carries both parts
(`?name=...&code=1234`) to prefill both inputs — the vendor still must submit through the
rate-limited verify endpoint; the link is not itself a bypass.

## Name normalisation — leniency in typing, no leniency in the guess space

`normalizeVendorCodeName(input: string): string` (new, `lib/vendor-registration-code.ts`):
lowercases, Unicode-NFD-normalises and strips combining marks (handles accents:
`"Café Été"` → `"cafeete"`), then strips every character that is not `[a-z0-9]` (spaces,
hyphens, underscores, punctuation all removed). Applied identically at issue time (building
`registrationCodeNameSlug` from `businessName`) and at verify time (normalising whatever the
vendor typed) — see
`vendor-registration-code-name-normalization.expected.md` for the exact test table. This is a
**deterministic** function, not fuzzy matching — it never treats two different names as equal
unless their normalised forms are byte-identical, so it cannot widen the 4-digit guess space. It
only forgives case, spacing and punctuation a vendor might type differently from how the
business name is stored (`"fynbos pottery"`, `"Fynbos-Pottery"`, `"FYNBOS POTTERY"` all
normalise to `"fynbospottery"`).

## Data model — additive to `VendorApplication`, old token fields deprecated-in-place

New optional fields on `VendorApplication` (`types/index.ts`), grouped under an M4 comment
block, same deprecate-in-place convention as every prior mission here:

```
registrationCodeId?: string | null              // 4-digit string, zero-padded, e.g. "0482"
registrationCodeNameSlug?: string | null         // normalizeVendorCodeName(businessName) at issue time
registrationCodeIssuedAt?: Date | null
registrationCodeExpiresAt?: Date | null
registrationCodeConsumedAt?: Date | null         // mirrors registrationTokenConsumedAt's role
registrationCodeFailedAttempts?: number | null    // reset to 0/null on every reissue
registrationCodeLockedAt?: Date | null            // set once failedAttempts crosses the threshold
```

`registrationTokenIssuedAt` / `registrationTokenExpiresAt` / `registrationTokenConsumedAt`
(F3, M1) are **not removed** — deprecated-in-place, same rule as every other field in this
project. See "Migration" below for why nothing currently depends on them.

### Why the code is stored in cleartext, not hashed

Every other secret in this codebase (HMAC tokens, recovery tokens) is verified without ever
being stored — that pattern doesn't fit here because Lee-Ann must be able to **read the current
code back out** to a vendor over the phone (Brad's explicit requirement: "admin visibility...
needs to see a vendor's code... and read it to them"). A hash cannot be reversed for that
purpose. Given the code is already a low-entropy secret (10,000 values) whose real protection is
the per-application lockout below — not secrecy of the stored representation — hashing would
add cost without adding real resistance to the threat that matters (online guessing), while
breaking the one requirement that needs cleartext. Storing cleartext is therefore the correct
tradeoff, not a shortcut; recorded here so it isn't re-litigated as an oversight.

## Generation — CSPRNG, never sequential, never derived

`generateVendorRegistrationCodeId(): string` (new): `crypto.randomInt(0, 10000)` (Node's CSPRNG
`randomInt`, not `Math.random()`), zero-padded to 4 digits via `String(n).padStart(4, '0')`.
Never a function of `applicationId`, an incrementing counter, or the current timestamp — a
sequential or derived code would make guessing trivial regardless of every rate limit below.
Codes are **not** required to be globally unique across all applications (see "Why two vendors
can share a 4-digit code" below) — no retry-on-collision loop is needed at generation time.

### Why two vendors can share a 4-digit code, safely

The identity that must be unique is the **pair** (`registrationCodeNameSlug`,
`registrationCodeId`), not the 4 digits alone. Verification (F22) queries
`vendorApplications` by `registrationCodeNameSlug` first (an indexed, non-secret field), then
compares `registrationCodeId` against every matching candidate. Two differently-named vendors
coincidentally minted the same 4 digits never collide in practice, because their name slugs
differ. Two vendors who happen to share both a name slug (rare) and the same 4 digits is a
CSPRNG birthday-bound edge case Lee-Ann can resolve manually via the admin reissue button if it
ever actually occurs (not machine-checked — genuinely rare and low-stakes).

## Verification, rate limiting, and lockout thresholds

`verifyVendorRegistrationCode(input, candidates, now)` (new, pure function, no Firestore):
takes the normalised typed name slug and typed 4-digit string, plus every matching
`VendorApplication` candidate already fetched by the caller (one Firestore query, always run,
regardless of whether zero, one, or many documents come back — see "Enumeration blindness"
below), and returns the single matching application's id on success or a single generic
refusal otherwise. The 4-digit comparison uses `constantTimeEqual`, **imported from**
`lib/recovery-token.ts` (reuse, never redefined — same rule F3 already established for the HMAC
module) — a short secret is still a secret; a length/early-exit timing difference must not leak
which digit position first diverges.

**Per-application lockout: 5 failed attempts, no auto-expiry.**
Rationale: the counter lives on the `VendorApplication` doc itself, not per-IP, so it bounds
guessing regardless of IP rotation or distributed attempts. At 5 attempts against a 10,000-value
space, an attacker gets at most a 5-in-10,000 (0.05%) chance of success before the application
locks — the number that actually matters for the "not the only barrier" requirement. It does
**not** auto-expire: a timed unlock lets an attacker simply wait out the window and retry
indefinitely, and the cumulative success probability across N lockout cycles grows with N (a
short auto-expiry effectively removes the bound). Lockout is instead cleared only by an
operator action — see "Reissue, not unlock" below.

**Per-IP throttle: 10 attempts / hour, secondary control.**
Reuses `lib/resend-rate-limit.ts`'s existing `decideRateLimit()` exactly as
`lib/vendor-registration-rate-limit.ts` (F5/M1-adjacent) already does for the register route —
no new sliding-window arithmetic. Key namespace `vendor-register-code-verify-ip:*`, distinct
from the register route's own `vendor-register-ip:*`. This throttle exists to slow down an
attacker spraying many *different* business names from one IP (the per-application lock alone
doesn't limit that, since each guessed name only accrues its own counter) — it is explicitly a
best-effort deterrent, not the security boundary, same documented caveat as the existing
per-IP limiter (spoofable `x-forwarded-for`, in-memory/not cross-instance).

**Attempt recording is transactional**, mirroring `lib/vendor-registration-token-claim.ts`'s
existing `claimRegistrationToken()` shape exactly: read the candidate application(s), check/
increment `registrationCodeFailedAttempts`, set `registrationCodeLockedAt` on crossing the
threshold, write — all inside one `db.runTransaction()` per candidate, so concurrent guesses
against the same application cannot race past the counter.

## Reissue, not unlock — one operator action, not two

There is no separate "unlock" primitive. `POST /api/admin/vendors/applications/[id]/reissue-code`
(F25, capability-gated identically to the existing review route:
`getAdminSession()` → `hasCapability(..., 'review-vendor-applications', ...)`) always: mints a
fresh `registrationCodeId` (new CSPRNG draw), resets `registrationCodeFailedAttempts` to 0,
clears `registrationCodeLockedAt`, and refreshes `registrationCodeIssuedAt`/
`registrationCodeExpiresAt`. Available any time `status === 'approved'`, not gated on being
currently locked — Lee-Ann needs it just as much for "the vendor lost the email" as for a
lockout. A single button covers both cases; a locked-out legitimate vendor calls the office,
Lee-Ann clicks Reissue, reads the new code aloud. This also means a successful attacker's guess
window is naturally closed the moment a real vendor reports trouble getting in — reissuing
invalidates whatever the attacker was working against too.

## Enumeration blindness

The verify-code endpoint (F23) returns exactly one generic body/status for every failure
mode — no such name slug in the collection, name found but wrong 4 digits, application locked,
application already consumed, application expired, application not `approved`:
`{ error: "That code didn't match. Double-check the business name and 4-digit code, or call the
show office." }`, HTTP 403. The "call the show office" clause is deliberately baked into the
copy itself (not conditional on lock state) so a genuinely locked-out vendor has a recovery
path without the response ever revealing that lock state exists. The success response is
`{ ok: true }` (plus the session artifact — see "Migration" below) at HTTP 200. Exactly two
possible bodies, never a third that leaks which failure occurred.

The Firestore query shape is identical on every path: one `where('registrationCodeNameSlug',
'==', normalizedSlug).where('status', '==', 'approved').get()` call, always executed, whether
zero or more documents come back — no branch that skips the query for a not-obviously-real name,
which would otherwise create a response-latency oracle distinguishing "no such vendor" from
"vendor exists, wrong code."

## Migration — replace the vendor-facing mechanism, reuse the HMAC module internally

**Decision: replace outright**, not ride alongside. There are currently zero real
`VendorApplication` documents (confirmed by the orchestrator's brief), so there is no in-flight
legacy token to preserve and no backfill script is needed. Concretely:

- `POST /api/admin/vendors/applications/[id]/review`'s `approve` action (F5, M1) stops calling
  `mintVendorRegistrationToken()` at approval time and instead generates the readable code
  (F24): `registrationCodeId` + `registrationCodeNameSlug`, 14-day expiry (reusing the exact
  `VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS` *value* — 14 days is still the right default,
  vendor-facing TTL is unchanged; only *what* gets issued changes).
- The full registration route (F23) stops accepting a `?token=` search param as its vendor-
  facing gate. `POST /api/vendors/register` (F7, M1) stops accepting the human `token`/code
  directly in its body.
- **`lib/vendor-registration-token.ts` (F3, M1) is NOT deleted or rewritten.** Its
  `mintVendorRegistrationToken`/`verifyVendorRegistrationToken` pair is repointed to a new
  role: an **internal, short-lived (30 minute `ttlMs` override, not the 14-day default) session
  artifact**, minted server-side the moment `verifyVendorRegistrationCode()` succeeds, and
  required (re-verified server-side, exactly as F7 already re-verifies today) by
  `POST /api/vendors/register` in place of the old vendor-typed token. The vendor never sees
  this artifact's contents — it travels as an HttpOnly cookie set by the verify-code response,
  never in the response JSON body (see the POPIA finding above) and never in a URL. Zero lines
  of `lib/vendor-registration-token.ts` or `lib/vendor-registration-token-claim.ts` change;
  only the call sites move. This is why the migration is low-risk despite touching two live
  routes: the single-use claim, the transactional atomicity, the constant-time signature check
  — every load-bearing property F3/F7 already proved — carries over unchanged, just triggered
  by a different, earlier event (code verified, not admin-approval email opened).
- **Recorded safety net for any stray legacy record** (defensive, not expected to trigger):
  if a `VendorApplication` is ever found `approved` with old `registrationToken*` fields set but
  no `registrationCodeId`, the same F25 reissue action mints a code for it — the operator
  path already covers this case, so no separate migration script is written.

## Also specified

- **Approval email (F24)**: `emails/VendorApprovalConfirmation.tsx` gains the readable code,
  formatted for reading aloud — business name as typed, then the 4 digits **space- or
  hyphen-grouped** (e.g. `4 8 2 1` or `4-8-2-1`, not run together as `4821`) directly under a
  "Your registration code" heading, plus the convenience link
  `${SITE_URL}/national-show/vendors/register?name=<urlencoded businessName>&code=<4 digits>`.
  `registrationLink` (the old token-bearing link prop) is renamed/repurposed to carry this new
  prefill link shape — same optional-prop pattern F6 already established, no new required prop.
- **Admin visibility (F25)**: `VendorApplicationReviewTable.tsx` gains a "Code" column showing
  `registrationCodeId` (or "—" pre-approval) and a locked badge when `registrationCodeLockedAt`
  is set, plus a "Reissue code" button wired to the new route. Never renders
  `registrationCodeId` for a non-approved application (nothing has been minted yet).

## What could not be honoured exactly as Brad stated it, and why

Nothing in the *display* format changes from what Brad asked for. The one addition beyond his
literal words is the two-field entry UI instead of one parsed string (see "Format" above) —
a robustness decision forced by business names legitimately containing hyphens, not a security
hedge and not a scope reduction; the thing Lee-Ann reads aloud and the thing printed in the
email is still exactly `BusinessName-1234`.

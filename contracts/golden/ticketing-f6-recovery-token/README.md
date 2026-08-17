# F6 (ticketing-foundation) — signed order-access recovery token, rate-limited resend: decision record

## Scope boundary — what F6 is, and what it deliberately is NOT

F6 adds three pure, side-effect-free modules (spec §8.2): `lib/recovery-token.ts` (mint/verify a
signed, HMAC-based, single-order-scoped, time-boxed token), `lib/resend-rate-limit.ts` (a pure
rate-limit decision function with injected time and injected counter state), and
`lib/resend-response.ts` (a pure builder that makes the resend endpoint's response identical
regardless of whether the email matched). It does **not** build the actual Next.js route
handlers — `GET /tickets/recover` (Firestore order lookup by verified token, QR rendering) and
`POST /tickets/resend-my-tickets` (Firestore email lookup, real counter persistence, actual email
dispatch via F11's `sendConfirmationEmail`) are out of scope, same reasoning F5 used for its own
route boundary. It does **not** wire `mintRecoveryToken()` into order creation (storing the
token/its expiry on the `orders` document at creation time is F10's ITN-rewrite job, or
wherever order creation is finalised) — F6 proves the primitive is correct; a later feature calls
it. The live, end-to-end proof of the wired routes — a human clicking a real recovery link and a
real resend form — is F14's job, exactly the milestone sequencing the mission file already lays
out (F6 in M1, F14 in M3).

## The three modules `@dev` must implement

See the contract's `features[0].name` for exact exported signatures. Summary:

1. **`lib/recovery-token.ts` (new)** — `mintRecoveryToken()` / `verifyRecoveryToken()`, an
   HMAC-SHA256-signed, base64url-encoded `{orderId, expiresAt}` payload plus a hex signature
   segment (`<payload>.<signature>`), with an injectable `compare` parameter for the signature
   check (defaulting to the module's own `constantTimeEqual`, built on `node:crypto`'s
   `timingSafeEqual`).
2. **`lib/resend-rate-limit.ts` (new)** — `decideRateLimit()`, a pure sliding-window decision
   over an injected `priorAttempts` array, keyed by an opaque `key` string the caller constructs
   (e.g. `email:<address>` or `ip:<addr>`) so the same function serves both the email-level and
   IP-level limits the spec requires.
3. **`lib/resend-response.ts` (new)** — `decideResendOutcome()`, which always returns the same
   shared `RESEND_MY_TICKETS_PUBLIC_RESPONSE` object reference regardless of whether the email
   matched an order or the request was rate-limited, while separately reporting (for
   server-side-only logging) whether an email should actually be sent.

None of the three modules touch Firestore, Firebase Auth, or the network. All three mirror the
"decision function, not I/O" shape F3/F4/F5 already established in this mission
(`lib/admin-roles.ts`'s `resolve()`, `lib/admin-auth.ts`'s `resolveRoleCapabilitiesForShow()`,
`lib/buyers.ts`'s `buildBuyerDocument()`).

## Why the token format is `HMAC-SHA256(secret, base64url(payload))`, not PayFast's MD5 idiom

The brief asks to "reuse the established approach rather than inventing a second crypto style."
`lib/payfast.ts`'s `generateSignature()`/`generateNotifySignature()` are **not** actually HMAC —
they're a plain MD5 digest of a parameter string with an optional passphrase appended
(`md5(paramString + '&passphrase=' + urlencode(passphrase))`), which is PayFast's own documented
scheme, not a general-purpose signing primitive this project chose. Reusing that exact
construction here would mean: (a) MD5, a broken digest for anything security-load-bearing that
isn't dictated by an external vendor's spec, and (b) a "passphrase appended to a param string"
shape that has no natural single-secret-key reading — HMAC is the actual right primitive for "one
server-only key signs a payload," and Node's `crypto.createHmac('sha256', secret)` is already a
dependency-free stdlib call, exactly like `createHash('md5')` is in `payfast.ts`. **What *is*
reused from `payfast.ts`:** the pattern of "one small pure function, well-commented, built on
`node:crypto`, with the algorithm choice justified in a comment referencing where it's used" —
the same shape, not the same digest. `lib/booking-ref.ts`'s 60-bit-entropy reasoning is reused
directly for the *secret* generation this contract assumes callers do (`crypto.randomBytes`),
consistent with the mission brief's "same entropy standard as booking references" instruction
(spec §8.2(a)) — this contract doesn't mandate 60 bits specifically for the HMAC *secret* itself
(a server-only, long-lived signing key should be at least 256 bits, per constant-time-safe HMAC
practice, not the door-legible 60-bit standard booking refs use for a different reason — human
readability under time pressure, which a signing key never needs). See "Judgement calls" below.

## Forgery resistance — what A3 proves and why it's a real attack, not a structural assertion

Design constraint 1 requires proving, with a real forgery attempt, that an attacker holding a
full public order document cannot mint a valid token. `check-forgery-resistance.mjs` does not
assert "the secret is server-only" as a claim about the code's shape — it takes five different
plausible "what if the secret were secretly derivable from public fields" strategies (the order
id itself, the buyer email, an id+amount concatenation, a SHA-256 of every public field
concatenated, and the empty string), independently mints a token using each guessed value as the
HMAC key, and checks that every single one of those forged tokens is refused when verified
against the REAL, independently `crypto.randomBytes`-generated secret. A sanity control (the real
secret verifying its own token) runs first, so a broken `verifyRecoveryToken()` that rejects
everything can't produce a false pass by accident.

## Constant-time comparison — proven by dependency injection, not by timing measurement

Design constraint 2 asks for a named defeating mutation catching a naive `===`. **Genuine
timing-side-channel measurement is out of scope for this contract, and this is a deliberate
scope line, not an oversight** — see "What this contract does NOT prove" below; it's the same
class of problem the mission brief itself names for the email-enumeration property ("timing-
channel equality is NOT proven by this contract"), and for the same reason: statistical timing
measurement on a shared CI/dev machine is exactly the kind of flaky, non-deterministic check this
project's coding rules and this mission's own standing "no flaky timeouts" lesson (F5's
`setsid`/darwin incident) argue against building.

Instead, `verifyRecoveryToken()` is required to accept an **injectable `compare` parameter**
(`SignatureCompare = (a: Buffer, b: Buffer) => boolean`), defaulting to the module's own
`constantTimeEqual` (built on `node:crypto`'s `timingSafeEqual`). `check-constant-time-compare.mjs`
proves two things behaviourally: (a) the default, uninjected comparison correctly rejects a
corrupted signature (the sanity control — an always-broken comparator would trivially "pass" the
next check for the wrong reason); (b) injecting a spy `compare` that **always returns `true`**,
alongside a token whose signature has been corrupted, still results in a successful verification.
(b) is the load-bearing proof: it shows `verifyRecoveryToken()` genuinely delegates trust to
whatever `compare` decides, rather than running its own separate, hardcoded `sigHex === expectedHex`
check somewhere in addition to (or instead of) the injected one. **The named defeating mutation**
is exactly that: replace the `compare(...)` call inside the function with a direct string
comparison. That mutation would make test (b) fail — the corrupted-signature token would be
refused regardless of what the always-approving spy says, because the hardcoded check would catch
it first. This is the same "prove the hook is load-bearing, not decorative" technique F5's A4
uses for a different property (proving `hasCapability()` isn't vacuously `false` for everyone).

`constantTimeEqual()` itself is additionally unit-tested directly for the three cases that matter
for correctness (not timing): equal buffers → `true`, unequal-length buffers → `false` without
throwing (per `node:crypto`'s `timingSafeEqual`, which throws on a length mismatch — the module's
`constantTimeEqual` MUST guard the length check before delegating, exactly as documented in the
contract's feature description), and equal-length-but-different buffers → `false`.

## Per-order scoping and tamper resistance — proven against the real function's return value

Design constraints 3 and 4 ask for behavioural proof, not an assertion. `check-order-scoping.mjs`
mints a real token for `'order-A'`, calls the real `verifyRecoveryToken()`, and feeds its actual
returned `orderId` into the exact comparison a real route boundary check would perform (mirroring
spec §8.5's `if (req.user.uid !== order.buyerUid) throw 403` pattern, applied to the token's
scope). It's refused for `'order-B'` and a third, unrelated order id (guarding against an
accidental prefix-match bug). `check-tamper-fields.mjs` starts from one real, valid, minted token
and, on three independent copies, tampers the decoded orderId, the decoded expiry, and one hex
character of the signature — in the orderId/expiry cases deliberately **reusing the original,
un-recomputed signature**, because that's the exact shape of "a token whose payload changed but
whose signature was not recomputed" the brief names explicitly. All three mutants are refused
with reason `'bad-signature'` specifically (not merely "not ok"), and a fourth, untampered control
token verifies successfully, proving the mutants fail because of the tampering and not because
verification is broken outright.

**A caveat about this check's coupling to the payload encoding.** `check-tamper-fields.mjs`
decodes the token's payload segment as `base64url(JSON.stringify({o, e}))`, per the format the
contract's feature description specifies. If `@dev` implements a different (but still
functionally correct) payload encoding, this specific check's decode step will fail loudly with a
clear "could not decode/parse" message rather than silently passing for the wrong reason — a
legitimate contract/implementation mismatch to resolve by aligning one or the other, not a bug in
the check.

## Expiry — injected time only, mirroring `ShowWindow`/`ShowWindowLookup`

Design constraint 5 is proven the same way F4's `ShowWindowLookup` inside-window/lapsed cases are
proven in `lib/admin-auth.ts`'s own contract: every call to `mintRecoveryToken()` and
`verifyRecoveryToken()` takes an explicit `now`, and `check-expiry-injected-time.mjs` exercises
five fixed `now` values (at mint time, 1ms before expiry, exactly at the expiry boundary, 1ms
after, and a day after) with zero wall-clock sleeps and zero `Date.now()` calls in the test
itself. **The boundary is defined as expired, not valid** (`now.getTime() >= expiresAt.getTime()`)
— consistent with `isWithinWindow`'s inclusive-both-ends convention in `lib/admin-auth.ts` reading
oddly if copied verbatim here (that function treats `endDate` itself as still valid, appropriate
for a show's calendar-day window); a token's expiry is a precise instant, not a calendar day, so
excluding the exact boundary instant is the safer, narrower reading and is what this contract
requires. If `@dev`'s implementation instead treats the boundary instant as still valid, this
specific case in A7 will fail loudly rather than silently pass — a legitimate design detail to
resolve, not a check bug.

## Zero authorization meaning — proven against the real F4 functions, mirroring F5's A3/A4

Design constraint 6, and the brief's explicit instruction to assert this "against the real
`hasCapability()`/`resolveRoleCapabilitiesForShow()` functions the way F5's A3 does."
`check-zero-authorization-meaning.mjs` reuses F5's exact harness shape (a fabricated
`DecodedIdToken`-shaped object with no `admin` claim and no `roles` claim, checked against every
one of the seven live `CAPABILITIES`, against a deliberately generous show-window lookup so a
failure can only be explained by the identity itself carrying nothing grantable) — applied here to
an identity shaped like "a recovery-link visitor," i.e. built from the token's own verified
`orderId` re-purposed as a `uid`-like field, since minting/verifying a recovery token never
touches Firebase Auth at all and so has no real `DecodedIdToken` of its own to test against. This
check does **not** duplicate F5's A4 (the non-vacuous-admin-control guard) — F5's A4 already
proves `hasCapability()`/`resolveRoleCapabilitiesForShow()` are non-vacuous for a real admin token,
and re-running that exact proof here would test nothing new about F6's own code; this check's
job is specifically "does *this* identity shape resolve to nothing," and it reuses the same
already-proven-non-vacuous functions.

A second, narrower proof closes a different gap: `verifyRecoveryToken()`'s own success shape is
checked at runtime to carry exactly `{ok, orderId, expiresAt}` and explicitly NOT `roles`,
`admin`, or `capabilities` keys — so there's nothing on the verification result itself a future
caller could mistakenly forward into an authorization check and have it do anything.

## Rate limiting — trigger, keying, and rolling, each proven independently

Design constraint 7. `check-rate-limit-trigger-and-keying.mjs` proves, using
`decideRateLimit()`'s real, injected-time, injected-counter-state decision:

1. **Trigger.** `MAX_ATTEMPTS - 1` prior attempts still allow the next call (the final permitted
   attempt); `MAX_ATTEMPTS` prior attempts refuse the next call, with a positive `retryAfterMs`.
2. **Keying.** A key with `MAX_ATTEMPTS` exhausted attempts does not affect a *different* email
   key or a differently-namespaced IP key checked against the exact same `priorAttempts` array —
   proving the function filters by key rather than merely counting array length. A mixed-key
   array (one key exhausted, another with a partial count, in the SAME array) confirms each key's
   count is computed independently.
3. **Rolling.** A key whose only prior attempts are all older than the window is fully allowed
   again (not permanently locked out), and a partial-roll case (some attempts inside the window,
   some outside, for the same key) confirms attempts age out individually — a genuine sliding
   window, not an all-or-nothing fixed bucket reset on an arbitrary clock boundary.

**What this does not prove:** that a real caller actually applies the function twice (once keyed
by email, once by IP) and combines the two decisions correctly (refuse if either refuses) — that
composition lives in the route handler, out of F6's scope (see "Scope boundary" above), and is
covered by F14's live proof, not this contract.

## Email enumeration — identical response, proven by reference equality

Design constraint 8. `check-resend-response-shape-identity.mjs` calls `decideResendOutcome()`
across all four combinations of `orderMatched`/`rateLimited` and asserts `result.publicResponse`
is the **same object reference** as the exported `RESEND_MY_TICKETS_PUBLIC_RESPONSE` constant in
every case — a materially stronger guarantee than deep-equality, since it makes "a future edit
adds a differing branch for one case" a compile-time/structural impossibility rather than merely
"currently untested." `shouldSend`/`logReason` are checked to differ correctly across the same
four combinations, proving the identical public response isn't because the function ignores its
input; a cross-combination check additionally confirms all four calls produce the exact same
reference, not four separately-`===`-equal-to-the-constant-but-distinct objects. The response body
text and status code are also scanned for literal leak phrases (`'not found'`, `'invalid email'`,
etc.) and confirmed to be `200` in every case, since a differing status code is itself an
enumeration oracle even with an identical body.

**Timing-channel equality is explicitly NOT proven by this contract** — the brief names this gap
directly. `decideResendOutcome()` being pure and side-effect-free (no Firestore read, no email
send inside the function itself) means the actual timing difference an attacker could measure
lives entirely in the route handler's I/O (does the route perform a Firestore lookup before or
regardless of matching, does the email actually get sent), which is out of F6's scope and unbuilt
as of this contract. Whoever wires the real route (F14, most likely, since it's the feature that
proves this endpoint end-to-end) should perform the lookup unconditionally, before branching on
`orderMatched`, specifically to keep the two code paths' wall-clock timing close — noted here as
the recommended implementation shape, not something this contract can enforce.

## Every assertion and its defeating mutation

- **A1 (`pnpm type-check`).** Defeated by a type error anywhere in the three new modules.
- **A2 (compiler fixture).** Defeated by: narrowing/widening any of the three modules' exported
  types away from the golden spec; removing or mistyping `verifyRecoveryToken`'s `compare`
  option; typing `decideResendOutcome()`'s `publicResponse` as a widened structural shape instead
  of `typeof RESEND_MY_TICKETS_PUBLIC_RESPONSE`.
- **A3 (forgery resistance).** Defeated by any implementation where a token minted with a value
  derived from public order fields (rather than the real, independently-generated secret)
  verifies successfully against the real secret.
- **A4 (constant-time comparison).** Defeated by: replacing the injected `compare(...)` call
  inside `verifyRecoveryToken()` with a direct `sigHex === expectedHex` comparison (test (b)
  would then reject the corrupted-signature token regardless of the always-approving spy);
  `constantTimeEqual()` throwing instead of returning `false` on unequal-length buffers; or
  `constantTimeEqual()` returning `true` for two different, equal-length buffers.
- **A5 (order scoping).** Defeated by `verifyRecoveryToken()` returning an `orderId` that doesn't
  genuinely correspond to the order it was minted for, or by any implementation that resolves a
  token's scope from something other than the value embedded and signed at mint time.
- **A6 (tamper on every field).** Defeated by any implementation that verifies a token whose
  decoded payload was changed but whose signature segment was left as originally minted — i.e.
  any implementation that fails to recompute and compare the signature against the payload
  actually presented, for orderId, expiry, or the signature bytes themselves.
- **A7 (expiry, injected time).** Defeated by: calling `Date.now()`/`new Date()` internally
  instead of using the injected `now` (this check would then fail non-deterministically depending
  on when the gate happens to run, or pass/fail inconsistently across two runs); or an off-by-one
  in the boundary comparison (treating the exact expiry instant as still valid).
- **A8 (zero authorization meaning).** Defeated by any change that causes
  `resolveRoleCapabilitiesForShow()`/`hasCapability()` to grant a non-empty capability set to a
  recovery-token-holder-shaped identity, or by `verifyRecoveryToken()`'s success result gaining a
  `roles`/`admin`/`capabilities` key.
- **A9 (rate limiting).** Defeated by: the limit never triggering (allowed stays `true` past
  `maxAttempts`); one key's attempts counting toward a different key's budget; or a key remaining
  refused forever after its attempts have aged out of the window.
- **A10 (response shape identity).** Defeated by `decideResendOutcome()` constructing a
  freshly-built response object (even one that's currently deep-equal) instead of returning the
  shared constant, or by any branch that changes `status`/`body` based on `orderMatched` or
  `rateLimited`.
- **A11 (`pnpm lint`).** Defeated by any lint violation in the three new files.

## What this contract does NOT prove

- **Genuine timing-side-channel measurement**, for both the signature comparison (A4) and the
  resend endpoint's response latency (A10). Both are structurally guarded (an injectable,
  constant-time-primitive-backed comparison hook; a byte-identical shared response object) but
  neither is proven immune to a *measured* timing attack by this contract — that would require
  statistical benchmarking across many trials on a specific machine, which is exactly the flaky,
  non-deterministic check class this project's coding rules and this mission's own `setsid`/darwin
  incident (F5) argue against building into a gate. Named explicitly per the architect brief's
  instruction, not silently downgraded to a source-grep-shaped assertion instead.
- **The real Next.js route handlers** (`GET /tickets/recover`, `POST /tickets/resend-my-tickets`)
  and their Firestore/email wiring — out of F6's scope (see "Scope boundary" above). This includes
  whether the routes actually apply `decideRateLimit()` twice (email-keyed and IP-keyed) and
  combine the two decisions correctly, and whether the route performs its Firestore lookup
  unconditionally (the recommended shape for keeping A10's response-shape guarantee meaningful
  under real timing, per the note above). F14 is where this becomes testable and should be
  proven live.
- **Storing `recoveryToken`/its expiry on the `orders` document at order-creation time.** F6
  proves the mint/verify primitive; wiring it into order creation (presumably F10's ITN-rewrite
  ceremony, or wherever order creation is finalised) is a separate feature's job. No F-item in
  the mission currently names this wiring as its explicit subject beyond F6's own "Done" wording
  ("`recoveryToken` is generated and stored on orders") — this is a real scope gap worth flagging
  before M1 is considered fully closed, mirroring F5's README flagging the guest-order-claiming
  backfill gap the same way.
- **The default token TTL's actual production value.** `RECOVERY_TOKEN_DEFAULT_TTL_MS` is
  specified as 180 days in the contract as a working placeholder so A2's fixture and A7's tests
  have something concrete to compile and mint against — it is explicitly not a Council-approved
  retention/access-window decision. See "Judgement calls" below.
- **The HMAC secret's actual storage/provisioning** (an environment variable, Secret Manager, or
  a dedicated signing key separate from any PayFast-related secret). The spec (§8.2) explicitly
  leaves "the same HMAC used elsewhere in this system (or introduce a dedicated signing key... the
  choice is a deployment detail)" open; this contract's checks always generate their own
  `crypto.randomBytes`-based secret in-process and never touch `process.env` for the real secret
  name, so it proves nothing about which env var name or Secret Manager entry the real deployment
  uses — that's a wiring decision for whoever builds order creation's real call to
  `mintRecoveryToken()`.
- **Firestore security rules**, same reasoning as F5's README — no `firestore.rules` file exists
  in this repo as of this contract, and nothing in F6 touches Firestore directly.

## Judgement calls made that the brief left open

1. **Token format: `${base64url(JSON.stringify({o: orderId, e: expiresAtEpochMs}))}.${hmacHex}`.**
   The brief specifies the security *properties* (unforgeable, constant-time-verified,
   single-order-scoped, tamperable-field-by-field, expiring) but not a wire format. JSON-in-base64url
   plus a separately-appended hex HMAC was chosen because it's the simplest shape that makes A6's
   "tamper one field, leave the signature untouched" test constructible without needing to
   reimplement a JWT library or pull in a new dependency — a `jsonwebtoken`-style JWT would work
   equally well functionally, but this project has no existing JWT dependency and adding one for a
   single token type is a heavier footprint than a ~15-line hand-rolled HMAC construction that
   mirrors the existing `payfast.ts` "one small pure crypto function" style. If `@dev` picks a
   different concrete encoding, `check-tamper-fields.mjs`'s payload-decode step is the one place
   in this contract coupled to the exact format — see the caveat under "Per-order scoping and
   tamper resistance" above for what happens then (a loud, clear failure, not a silent false
   pass).
2. **`RECOVERY_TOKEN_DEFAULT_TTL_MS` set to 180 days.** Not specified anywhere in the spec or the
   mission brief. Chosen as a plausible, generous default (long enough that a buyer recovering a
   ticket months after a show for a refund dispute or a records request isn't blocked by an
   arbitrarily short window) but explicitly flagged as a placeholder — this is exactly the kind of
   business-policy number (compare: F9's "placeholder price, explicitly noted as not final") that
   should be confirmed with Brad/the Council before the demo ships, not silently treated as
   settled by virtue of being in a contract. `mintRecoveryToken()`'s `ttlMs` parameter is
   overridable per-call specifically so changing the default later is a one-constant edit, not a
   signature change.
3. **`decideRateLimit()`'s `key` parameter is an opaque, caller-constructed string** (e.g.
   `email:<address>` or `ip:<address>`), rather than the function taking separate
   `email`/`ipAddress` parameters and computing two limits internally. Chosen because it keeps the
   function's own contract minimal and symmetric — "one key, one budget" — and lets the real route
   call it exactly twice with two different key namespaces without `decideRateLimit()` needing to
   know anything about what an email or an IP address looks like. The alternative (baking
   email/IP into the function's own signature) would make the function's own tests need two
   separate assertion shapes for what is structurally the same sliding-window logic.
4. **`constantTimeEqual()` is exported as a public, independently-testable function**, not an
   unexported internal helper — mirroring `lib/booking-ref.ts` and `lib/payfast.ts`'s pattern of
   exporting small, individually-unit-testable primitives rather than inlining them. This is also
   what makes A4's direct unit tests on `constantTimeEqual()` itself possible without needing to
   go through a full token mint/verify round trip just to exercise the comparison function's edge
   cases (unequal lengths, in particular).
5. **The manual/live gap (route wiring, real timing-channel measurement, TTL policy, secret
   provisioning) is recorded here, in F6's own golden README, rather than proposing new mission
   F-items.** Architect scope is F6's contract; adding or reassigning mission F-items is the
   orchestrator's/Brad's call, same precedent F5's README set for its own manual-verification
   gap.

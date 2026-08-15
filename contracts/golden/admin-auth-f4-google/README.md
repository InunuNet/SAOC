# admin-auth-f4-google — F4 (milestone M2)

Mission: `.agent/memory/project/missions/2026-08-14-admin-auth-hardening.md`, feature F4.
Builds on `contracts/contract-admin-auth-hardening.yaml` (F1+F2, green) and
`contracts/contract-admin-auth-f3-provisioning.yaml` (F3, green) — read both READMEs first if
you have not already; this one assumes them.

**SCOPE 2026-08-15: Google only.** Microsoft and Apple are PARKED —
`contracts/contract-admin-auth-f5-federated.yaml` and its goldens are left on disk unchanged,
research intact, not required by anything in this contract. See that golden's own PARKED banner
for what must be re-decided before it resumes.

## Note on the flip-flop — read this first if you are confused by the history below

This decision changed twice in one day. Both changes are recorded in full below, not hidden, but
the short version for anyone short on time: **the final, settled design is claim-first
provisioning on the unchanged default account-linking setting** (Draft 2 = Draft 4 below). The
brief detour back to "Multiple accounts per email address" (Draft 3) happened because the team
lead's message accepting that design was written and queued BEFORE they had read the report that
reversed it to claim-first — the two messages crossed. Draft 3 correctly acted on the
acceptance message it had in hand, re-verified the facts (console URL, fixture buildability), and
found the acceptance's underlying premise about the console URL was right, but the SAME
re-verification also reconfirmed the fixture is permanently unbuildable and the UX cost is real —
which, combined, are exactly the reasons Draft 2 chose claim-first in the first place. Once the
message ordering was untangled, the team lead confirmed claim-first stands, final, not open to
further re-litigation absent a genuinely new fact. Nothing in this history reflects an error in
reasoning at any step — each draft was the correct response to the information in hand at the
time it was written.

## Why F4 is dangerous, not just additive

F3's whole squatter defence rests on one fact: `lib/admin-auth.ts` requires
`email_verified === true`, and Firebase email/password signup never sets that automatically.
A self-registered squatter is refused with `reason: 'email-unverified'` even if they somehow
acquired the admin claim. **Federated providers (Google, Microsoft, Apple) set
`email_verified: true` automatically, by design** — mailbox control is asserted by the IdP, not
by us. Adding Google sign-in without anything else would make F3's defence vanish the moment a
squatter's email happens to also be a real Google account (nearly always true).

## The real attack: account linking, not just auto-verification

Firebase's **default** behaviour — "One account per email address" — makes this worse than
"the squatter's account becomes verified." When a Google sign-in happens for an email that
**already has a password-provider account** (the squatter's), Firebase does not create a new
account. It **links** the Google credential onto the SAME account (same uid) and flips
`emailVerified` to `true` on it. The squatter's original password credential is untouched and
still works. So:

1. A squatter self-registers `chair@example.org` with a password of their choosing (self-signup
   is still open — F1/F2's own `A-PROBE-01` proves it).
2. Time passes. Nobody notices — the account is unverified, so F1's gate already refuses it.
3. The real chairperson, onboarded later, signs in with Google using the same address. Firebase
   links the Google credential onto the squatter's existing uid and verifies it.
4. If that email is on `ADMIN_EMAIL_ALLOWLIST` and an operator has granted the `admin` claim
   (to what they believe is the chairperson's account — it's actually the squatter's uid, they
   share one account now), **the squatter's original password now opens `/admin`.**

This is strictly worse than the F3 attack: F3's squatter was permanently locked out by
`email-unverified` until someone deliberately verified them. F4's squatter gets verified for
free, by an action the real chairperson took in good faith.

## Decision history

- **Draft 1:** switch Identity Platform to "Multiple accounts per email address" +
  `admin-grant.ts` `--uid` disambiguation.
- **Draft 2 (adopted):** withdrawn after a team-lead challenge that (a) misidentified the console
  setting as GCIP-only (later found to be wrong — the setting is NOT GCIP-gated, see below), but
  also correctly (b) doubted whether Draft 1's test fixture was constructable, and (c) correctly
  identified a real show-day UX cost. Replaced with **claim-first provisioning**: grant via
  `admin-grant.ts` before ever allowlisting an address, plus an explicit squatter-shape warning
  in `admin-grant.ts`'s existing refusal path.
- **Draft 3 (briefly reinstated, then reverted — see "Note on the flip-flop" above):** the team
  lead's message accepting Draft 1 (written before they'd seen the Draft 2 report) arrived and
  was acted on. Re-verification during Draft 3 confirmed the console URL correction was real
  (plain Firebase console, not GCIP) — but ALSO confirmed, live against the real project, that
  Draft 1's fixture (two Firebase Auth accounts sharing one email, built via Admin SDK) cannot be
  constructed under any project configuration (`auth.createUser()` enforces email uniqueness
  unconditionally — confirmed against Firebase's own Admin Auth API Errors reference and
  `firebase/firebase-admin-node` issue #45). Draft 3 kept Draft 1's decision anyway, converting
  the untestable behavioural checks to structural ones.
- **Draft 4 (this document, final):** once the message-ordering was untangled, the team lead
  confirmed the ORIGINAL Draft 2 reasoning stands: an untestable-by-construction fixture plus a
  real, disqualifying UX cost outweighs a platform-level fix that cannot be proven to work by
  anything in this project's toolchain. Claim-first is final.

## Decision (final): claim-first provisioning, on the unchanged default setting

**Decided:** leave Identity Platform's account-linking setting at its default, "One account per
email address." The defence is **ordering discipline plus a sharper warning**, not a platform
setting:

> **An email address must be granted via `scripts/admin-grant.ts` BEFORE it is ever added to
> `ADMIN_EMAIL_ALLOWLIST`.**

**Why this closes the attack.** An unallowlisted address grants access to nobody, squatted or
not (F1's third gate condition) — so there is never a legitimate reason to add an address to the
allowlist before it has gone through `admin-grant.ts` at least once. Two cases follow:

- **The address has no pre-existing account.** `admin-grant.ts` creates it, sets
  `emailVerified: true` (we created it, we can vouch for it — F3's existing rule), sets the
  claim. Firebase's own email-uniqueness enforcement (confirmed unconditional, see below) means
  **no one else can ever create a second account with this same email** via `accounts:signUp`
  from this point forward — the address is permanently "ours." When the real admin later signs
  in with Google, Firebase **links** the Google credential onto this SAME, already-legitimate
  account (adding it as a second working credential, not creating a new one) — this is desired,
  not dangerous: one identity, sign in with whatever's convenient, exactly the UX a platform-
  setting change would have broken (see "Why Draft 1 was rejected" below).
- **The address already has a pre-existing account** (a squatter got there first, via the
  still-open `accounts:signUp`). This is exactly the case F3's `A-GRANT-02`/`A-GRANT-03` already
  cover: `admin-grant.ts` refuses without `--existing`, prints provenance, and even with
  `--existing` never sets `emailVerified` — so the squatter stays locked out by
  `email-unverified` regardless. **What F4 adds here (`A-GRANT-04`):** the provenance print is
  strengthened to name the dangerous shape explicitly — "password provider only, never
  verified" — and tell the operator what to check (whether the person they intend to grant has
  *already* signed in via a federated provider somewhere, which would show up as an additional
  entry in `providerData`) before deciding whether `--existing` is safe.

## Why Draft 1 ("Multiple accounts per email address") was rejected, in full

Two independent, each individually sufficient, reasons — both re-confirmed during Draft 3 before
being reverted:

1. **The fixture its own tests needed cannot be built, under any project configuration.**
   `auth.createUser()` (the only account-creation path any check in this repo can use) enforces
   email uniqueness unconditionally. Confirmed live against the real `saoc-webapp` project: a
   second `createUser()` call for a duplicate email fails with `auth/email-already-exists`
   regardless of the account-linking setting's value. Confirmed independently via Firebase's own
   Admin Auth API Errors reference ("Each user must have a unique email," no setting-dependent
   carve-out) and corroborated against `firebase/firebase-admin-node` issue #45 (Admin-SDK-
   created accounts and client-side federated sign-ins for the same email never interact). The
   account-linking setting only changes what `signInWithPopup`/`signInWithRedirect`/
   `linkWithPopup`/`linkWithRedirect` do (Firebase's own support article,
   `support.google.com/firebase/answer/9134820`, names exactly those four functions) — all four
   require a REAL OAuth exchange with an actual identity provider, which nothing in this repo's
   toolchain can drive headlessly. A behavioural check built on this fixture would report
   PRECONDITION FAILED forever, not until a human acts — a permanently broken test disguised as
   an outstanding task.
2. **The UX cost is real and disqualifying on its own.** Under "Multiple accounts per email
   address," an admin who has a password account and later clicks "Sign in with Google" gets a
   **separate, new, unprivileged account** — not their existing one. Every provider an admin ever
   uses needs its own grant; nothing links them together automatically. Concrete failure: a door
   scanner volunteer at the National Show, under time pressure, taps "Sign in with Google"
   instead of their usual password and finds a fresh, non-admin account. F4 has no business
   introducing this.

(For completeness: the console-URL error in the very first draft — pointing at the GCIP console
instead of the plain Firebase console — was real but is NOT among the two reasons above; it
would only have meant fixing a URL, and was in fact confirmed correct once fixed. It did not
drive the final decision either way.)

## Decision: no new behavioural gate check for F4 (unchanged across every draft)

`lib/admin-auth.ts`'s decision reads exactly three fields off the decoded token: `admin`,
`email_verified`, `email` (checked against the live allowlist). Nothing in that function, or in
`app/api/admin/session/route.ts`, inspects which provider produced the token. F1/F2's
`A-STATE-01` already proves the gate refuses every unenumerated combination of those three
inputs, and `A-ALLOW-01` already proves a genuinely valid combination succeeds — both
independent of how the token was minted. `A-STRUCT-01` in this contract proves, structurally,
that no code path exists that could make the provider matter — this is what lets F1/F2's
existing proof generalise to Google without needing to drive a real OAuth consent flow in a
check (nothing in this repo's toolchain can do that headlessly, and a forged-claim token would
only prove something about our check code, not the real system).

## The residual risk, and how this closes it

Claim-first depends on operator discipline, not a technical guarantee. The concrete failure mode:
an operator runs `admin-grant.ts` on an address, finds a pre-existing account, misjudges it as
legitimate, and grants `--existing` onto what is actually a squatter's account. If the real admin
later signs in with Google, Firebase links onto that SAME account and verifies it — the original
attack, just requiring a human mistake at grant time instead of an automatic platform behaviour.

This is a real, not eliminated, weakness. Two things are done about it, both landing in this
contract, deliberately not more than two:

1. **The `A-GRANT-04` warning** turns an abstract "review the provenance" instruction (easy to
   skim past — F3 shipped exactly that shape before its own amendment tightened it) into a
   concrete, checkable fact printed at the moment it matters: *this account has never been
   verified by any identity provider*. An operator who reads "password-only, never verified,
   check whether they've already signed in elsewhere" is meaningfully less likely to rubber-stamp
   `--existing` than one reading only a uid and a timestamp.
2. **Ordering discipline is written into `docs/admin-access.md` as a hard rule, not a
   suggestion** (`A-DOCS-01`), following this project's own convention of documenting what
   cannot be scripted rather than pretending a script enforces it (see F3's self-signup section).

Accepted as a known, documented limitation, not solved further here — the team lead's own
assessment is that a platform-level structural fix would be strictly better IF it were provable
and free of UX cost, but it is neither, so operator discipline (backed by the sharper warning) is
the proportionate control for a "handful of admins" system.

## Where the provider credentials actually live (correcting an assumption)

Google's OAuth client configuration (a support email is all that's required — auto-configured,
tied to the project already on GCP) is entered into the **Firebase Console's Sign-in method
provider configuration**, which Identity Platform stores itself. **None of it lands in this
repository's `.env.local` or any app-level env var.** Our client code only ever references the
provider ID string (`'google.com'`) via `firebase/auth`'s `GoogleAuthProvider` constructor — the
actual OAuth exchange is handled entirely by Firebase's own hosted redirect handler
(`https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`). F4 adds zero new secrets to this
project's secret-corruption surface (see `docs/secret-corruption-incidents.md`) — it is entirely
console work, never a `.env.local` edit.

## What is deliberately out of scope here

- Actually enabling Google in the Firebase console or configuring the OAuth consent screen
  (documented, not performed).
- Microsoft and Apple sign-in — PARKED, see F5's own golden README banner. Nothing here depends
  on F5, and F5 does not block this contract.
- The human end-to-end door-scanner proof (F6, later milestone).
- Any change to `lib/admin-auth.ts`'s decision logic (asserted UNCHANGED by A-STRUCT-01).

## Full human prerequisite list for Google (the short version, handed to the user as-is)

1. **Firebase console → Authentication → Sign-in method → Google** — enable, set a support
   email. No client ID/secret to obtain; auto-configured on the existing GCP project. No
   `.env.local` change.
2. That's it. Claim-first provisioning needs no console-level account-linking change — the
   default "One account per email address" setting is kept as-is.

Nothing here touches `.env.local` or any Secret Manager value — nothing new to corrupt.

## Fixture accounts this contract's checks create and destroy

- **Squatter-shape fixture** (`admin-auth-f3-check-preexisting-<random>@saoc-contract-check.invalid`
  — reuses F3's `randomPreExistingFixtureEmail()`/`createPreExistingUnverifiedFixture()`
  directly, the same fixture convention `A-GRANT-02`/`A-GRANT-03` already use, deliberately not
  a new one): password provider, unverified, no claim. Deleted via `deleteUserIfExists()` in a
  `finally` in `A-GRANT-04`, whether the assertion passes or fails.

Nothing here leaves a standing privileged account, matching F1/F2/F3's convention.

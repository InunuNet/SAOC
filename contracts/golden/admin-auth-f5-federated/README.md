# admin-auth-f5-federated — F5 (milestone M2)

> **UNPARKED 2026-08-17.** Both open questions below now have a decision, made by the
> architect on resumption, autonomously, per this project's standing policy that a
> resumed session does not defer decisions back to the user mid-chain. Neither answer
> changes any check-script text or golden-file requirement already on disk.
>
> **Decision 1 — Apple Developer Program ownership (asked 2026-08-15, answered 2026-08-17):**
> proceed now on Brad's personal paid membership as a documented, temporary bridge — it is a
> fact about a person, not a property of the system, and could stop being true at any time
> (membership lapse, Brad's departure from the project). **Recommendation, logged as a
> needs-human item (not a launch blocker for this contract):** SAOC should obtain its own
> Apple Developer Program membership (or confirm the nonprofit fee-waiver applies to it)
> before the National Show 2027 launch, and re-point the Services ID/key/Team ID at the
> Council's own account at that time — a config-only change in Firebase Console, no code
> impact. Logged to `.agent/memory/project/needs-human.md`:
> `Apple Developer Program membership currently personal (Brad's) — SAOC needs its own before
> launch; Firebase Console Apple provider config swap only, no code change. — architect,
> 2026-08-17`. This does not block F5's code or docs work today.
>
> **Decision 2 — `privaterelay.appleid.com` vs. the email allowlist (asked 2026-08-15, answered
> 2026-08-17):** **Policy is option 1 — ask enrolling members to disable "Hide My Email"** at
> Apple sign-in, sharing their real address, so it behaves like any other address for
> allowlisting. This is the simpler default and matches what `docs/admin-access.md` must now
> state as the primary instruction. **Option 2 (capture the relay address from a refused first
> attempt, visible in `getAdminSession()`'s `not-allowlisted` log path) is documented as the
> fallback** for a member who declines to disable relay — not a coequal option, a fallback.
> Both remain safely refused-by-default until an operator acts either way.
>
> **F4's decision, for reference:** F4 settled on claim-first provisioning on the unchanged
> default account-linking setting — the body text below already reflects this and needed no
> correction. (History: F4's decision was briefly reverted to "Multiple accounts per email
> address" and back again the same day, due to two team-lead messages crossing in flight, not
> due to any new fact — see `contracts/golden/admin-auth-f4-google/README.md` "Note on the
> flip-flop" for the full account. Claim-first is F4's final, settled design.)

Mission: `.agent/memory/project/missions/2026-08-14-admin-auth-hardening.md`, feature F5.
Sibling to `contracts/contract-admin-auth-f4-google.yaml` — **F4 must land first**: this
contract touches the same file (`app/admin/login/page.tsx`) and reuses the session-mint funnel
and the claim-first/squatter-warning provisioning discipline F4 establishes.

**REVISED 2026-08-15** — F4's original design (switch Identity Platform to "Multiple accounts
per email address" + `admin-grant.ts` `--uid` disambiguation) was withdrawn after a team-lead
challenge (see F4's `README.md` "Decision reversed": the console setting wasn't GCIP-gated as
first claimed, but the defence built on it was untestable via any tooling this project has, and
it cost real UX — an admin's password and federated sign-ins would become permanently separate
accounts). F4 now uses **claim-first provisioning on the unchanged default account-linking
setting**. This means F5 has **no console-level sequencing dependency at all** — Microsoft and
Apple sign-in can be turned on any time after F4's login-page and provisioning-script changes
land, on the project's default Firebase Authentication configuration, no upgrade or setting
change required.

## Why this is a thin contract, not a parallel implementation

Everything that makes federated sign-in dangerous — auto-verified email, account linking onto a
squatter's pre-existing password account — is a property of **"a federated identity provider,"
not of Google specifically**. F4 already designed and asserted the general-purpose fix
(claim-before-allowlist ordering + the squatter-shape warning in `admin-grant.ts`) precisely so
Microsoft and Apple would not need their own copies — neither is provider-specific in any way.
This contract's job is only what is genuinely new per provider:

1. The login UI must actually offer Microsoft and Apple buttons (F4 only built Google's).
2. Apple's specific quirk, restated below.
3. Provider-specific human prerequisites (Entra registration, Apple Developer Program), which
   are pure documentation here, exactly as F3 documented the self-signup console step.

**Deliberately not re-tested here:** F4's `A-GRANT-04` (squatter-shape warning) and `A-STRUCT-01`
(gate stays provider-agnostic). Admin SDK fixtures cannot distinguish "shaped like a Microsoft
account" from "shaped like a Google account" any more precisely than F4's existing fixture
already does — the warning logic keys on `providerData` shape (password-only vs. anything else),
not on which specific federated provider is present, so nothing about Microsoft or Apple changes
what that check already proves. See F4's README "Decision: no new behavioural gate check for
F4/F5" for the fuller reasoning, which applies unchanged here.

## Decision: Microsoft tenant — allow any account, not a restricted tenant

**Decided:** register the Microsoft app for **"Accounts in any organizational directory and
personal Microsoft accounts"** (the multi-tenant + personal option, reached via the `common`
OAuth endpoint — Firebase's own `tenant` custom parameter defaults to `'common'` and needs no
value set for this choice). **Rationale:** this project has no evidence of possessing a
dedicated Azure/Entra tenant of its own (the mission brief flags this explicitly as a possible
blocker: "requires a Microsoft tenant the user may not have"), and restricting sign-in to a
single tenant would require creating and administering one solely for this purpose. The
allowlist (`ADMIN_EMAIL_ALLOWLIST`) remains the actual authorisation boundary regardless of
tenant restriction — a valid Microsoft sign-in from any tenant that is not on the allowlist is
refused identically to any other unrecognised identity (F1/F2's `A-STATE-01`/`A-ALLOW-01`,
generalised by F4's `A-STRUCT-01`). Restricting to a specific tenant later, if SAOC ever
provisions its own Entra tenant, is a config-only change (the `tenant` custom parameter) with no
code impact — deferred, not precluded.

## Decision: Apple — confirmed viable, cost and requirements verified live

Verified 2026-08-15 via Apple's own `developer.apple.com/support/compare-memberships/` page
(fetched through Alembic, per this project's URL-fetching rule): **Apple Developer Program
enrolment is 99 USD per membership year** (or local-currency equivalent), required to configure
Sign In with Apple at all — there is no free tier that includes it. A **nonprofit fee waiver**
exists (`developer.apple.com/support/membership-fee-waiver/`); whether SAOC specifically
qualifies and has applied is unconfirmed and out of scope for this contract to determine. Per
the mission's own notes, **Brad confirmed on 2026-08-14 that he already holds a paid membership**,
so this is not currently a blocker for this project — but the requirement is stated here in full
because it is real and would block a different implementer, and because "already paid" is a fact
about a person, not a property of the system, and could stop being true.

Required, per Firebase's own Apple sign-in guide (fetched via Alembic 2026-08-15):
- A **Services ID**, created on Apple's developer site, with the site associated to the app and
  the Firebase auth handler (`https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`) registered
  as its **Return URL**.
- A **Sign In with Apple private key**, generated in the same portal — note the **Key ID**.
- The account's **Team ID** (found on the membership page).
- Optionally, if this project ever sends Firebase Auth emails (verification, password reset —
  which F3's grant flow for FRESH accounts already does) to an Apple-relayed address,
  registering `noreply@<PROJECT_ID>.firebaseapp.com` with Apple's **private email relay
  service**, so those emails actually reach the user.

All four (Services ID, private key, Key ID, Team ID) are entered into **Firebase Console →
Authentication → Sign-in method → Apple → OAuth code flow configuration**, not into this repo's
`.env.local` or any app env var — same as Microsoft's Client ID/Secret and Google's support
email (see F4 README "Where the provider credentials actually live").

## Decision: Apple private email relay — allowlist implication, stated but not solved here

Apple's Sign In with Apple lets a user choose to share an **anonymised relay address**
(`<opaque>@privaterelay.appleid.com`) instead of their real email. This interacts directly with
this project's **email-based allowlist**: the relay address is opaque and per-user, generated
only at first sign-in, so it cannot be pre-populated into `ADMIN_EMAIL_ALLOWLIST` before that
first attempt. Two operationally viable paths, both documented (neither scripted, neither
asserted — this is a policy/process decision for the committee, not a code fix):

1. **Ask committee members enrolling via Apple to disable "Hide My Email"** at sign-in, sharing
   their real address, so it behaves like any other email for allowlisting purposes. **Decided
   policy, 2026-08-17** — see UNPARKED banner, Decision 2.
2. **Capture the relay address from a refused first attempt** (visible in `getAdminSession()`'s
   `reason: 'not-allowlisted'` server log path) and add that literal relay address to the
   allowlist. **Documented fallback** for a member who declines to disable relay — ties the
   allowlist entry to a value the member does not control and could rotate, so it is not the
   default.

`docs/admin-access.md`'s Apple section states option 1 as the primary instruction and option 2
as the fallback — either path is safely refused-by-default (`not-allowlisted`) until an operator
acts.

## Apple's `email` scope — defensive explicitness, not a workaround for a broken default

Firebase's own Apple sign-in guide states that with the default "One account per email address"
setting (which F4's reversed decision keeps — see above), Firebase **already auto-requests**
`email` and `name` scopes from Apple, so this project does not strictly need the explicit call
to get an email back. `A-STRUCT-01` still requires `provider.addScope('email')` explicitly
anyway, as defensive practice: relying on an implicit default that a future Firebase SDK version
or project setting change could alter is worse than stating the requirement in code where it is
visible and grep-able, and it costs nothing. This is a downgrade in urgency from the withdrawn
design (which needed the explicit scope to avoid a broken flow); it is kept as a cheap, sensible
requirement, not a load-bearing fix for anything.

## What is deliberately out of scope here

- Actually registering the Entra app or the Apple Services ID/key (documented, not performed).
- Actually enabling Microsoft/Apple in the Firebase console (documented, not performed).
- Re-testing the gate's provider-agnosticism or the claim-first/squatter-warning provisioning
  logic (F4 already proves both, generally — see above).
- The human end-to-end door-scanner proof (F6, later milestone).

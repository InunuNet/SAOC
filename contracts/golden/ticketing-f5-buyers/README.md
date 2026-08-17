# F5 (ticketing-foundation) — `buyers/{uid}`, POPIA consent, and the hard security boundary: decision record

## Scope boundary — what F5 is, and what it deliberately is NOT

F5 adds a `buyers` Firestore collection shape, a `newsletterOptIn` consent-recording structure,
and an optional `buyerUid` field on `orders` (spec §8.2-§8.4). It does **not** build any
buyer-facing route (`/tickets/recover`, `/tickets/resend-my-tickets`, `/my-tickets`, a signup
form) — those are F6 and F14. It does **not** build the automatic guest-order-claiming backfill
described in spec §8.3 ("Claiming guest orders by email match") — the mission brief is explicit
that "the backfill itself is not F5," and no later F-item in the mission currently owns it either;
that gap is noted below under "What this contract does NOT prove" rather than silently absorbed
into F5's scope. F5's job is narrower and more load-bearing than any of that: prove that the
*existence* of a buyer account and a `buyers` document carries zero authorization meaning,
provably, against the real decision functions and a real HTTP round trip — not by source-grep.

## The two modules `@dev` must implement

1. **`lib/buyers.ts` (new)**:
   - `export const BUYERS_COLLECTION = 'buyers';`
   - `export interface NewsletterOptIn { optedIn: boolean; optInAt: Date | null; source: string | null; }`
   - `export interface Buyer { uid: string; email: string; displayName?: string; newsletterOptIn: NewsletterOptIn; createdAt: Date; }`
   - `export function buildNewsletterOptIn(input?: { optedIn: boolean; source: string; now: Date }): NewsletterOptIn`
     — no argument, or `optedIn: false` regardless of what else is passed alongside it, always
     produces `{ optedIn: false, optInAt: null, source: null }`. Only `optedIn: true` (with
     `source` and `now` supplied) produces a real consent record.
   - `export function buildBuyerDocument(input: { uid: string; email: string; displayName?: string; newsletterOptIn?: { optedIn: boolean; source: string; now: Date }; now: Date }): Buyer`
     — `newsletterOptIn` defaults to the unticked shape (via `buildNewsletterOptIn()` with no
     argument) when the caller doesn't supply one.
2. **`types/index.ts` (extended)** — add `buyerUid?: string | null;` to the existing `Order`
   interface. Optional, not required: a pre-F5 `Order` literal that never mentions the field must
   still compile (A2 proves this with a real literal).

Neither module writes to Firestore. `lib/buyers.ts` is pure construction logic — the same
"decision function, not I/O" shape F3/F4 established for `lib/admin-roles.ts` and
`lib/admin-auth.ts`'s pure helpers. The actual Firestore write (creating a `buyers/{uid}`
document on signup) is wherever the signup flow gets built (out of F5's scope, same reasoning as
the backfill above) — this contract proves the *shape* of what gets written, not the write path.

## Why `buildNewsletterOptIn` forces `optInAt`/`source` to `null` when `optedIn` is false, even if a caller passes them

POPIA (§5.1, and spec §8.6) requires consent to be an auditable *record*, not an implied state.
If `buildNewsletterOptIn({ optedIn: false, source: 'signup-form', now })` were allowed to leak
`source`/`now` through into the stored document, a caller that fills in every field out of habit
— without first checking whether the box was actually ticked — would silently produce a document
that *looks* like it carries a consent timestamp for someone who never consented. Forcing the
false branch to zero out both fields, unconditionally, makes that mistake impossible to make by
construction, not merely unlikely. This is the same "fail-closed by construction, not by an
explicit branch a future edit could remove" instinct that shaped `lib/admin-roles.ts`'s `resolve()`
(F3) and `resolveRoleCapabilitiesForShow()`'s `null`-lookup handling (F4).

## The hard security boundary — how it's proven, and by which real functions

Spec §8.4(1) requires: *"A freshly self-registered account with a `buyers` document must resolve
to the empty capability set when checked against `lib/admin-roles.ts`."* The brief is explicit
that this must be proven **by calling the real `hasCapability()`/`resolveRoleCapabilitiesForShow()`**
(shipped by F4, `lib/admin-auth.ts`) — not by asserting a `buyers` document has no `roles` field,
which would prove nothing about what the authorization *decision* actually does with such a token.

**A3** (`check-buyer-empty-capability-set.mjs`) constructs a `DecodedIdToken`-shaped object with
exactly the claims a self-registered Firebase Auth buyer account carries: no `admin` claim, no
`roles` claim. It calls the real `resolveRoleCapabilitiesForShow()` and `hasCapability()` against
that token, across all seven of `lib/admin-roles.ts`'s live `CAPABILITIES`, and against a
deliberately *generous* show-window lookup (one that would grant a live window for `nationalShow`
if any role were present) — so a failure here can only be explained by the buyer token itself
carrying nothing grantable, never by an accidentally-closed date window masking the real property.
Two extra cases close specific gaps: `admin: false` explicit (not merely absent) is refused, and a
buyer whose email happens to coincide with an allowlisted admin email is *still* refused — because
there's no `admin` claim on that particular token, proving the check is `admin === true`, not
`isEmailAllowlisted(email)`.

### Why case (5) exists — the same defect shape F4's A3(e) already had once

QA mutation-tested this contract by making `hasCapability()` bypass the admin gate whenever the
token is non-admin but its email is allowlisted (`if (!isAdminToken(decoded) &&
!isEmailAllowlisted(decoded.email)) return false;` — i.e. an allowlisted-but-non-admin email walks
straight through). **Both A3 and A4 survived that mutation.** Root cause: every case in A3 that
varies the allowlist dimension — case (4) above — does so on a token with **no `roles` claim at
all**, so `resolveRoleCapabilitiesForShow()` returns the empty set regardless of whether the
allowlist bypass exists, and the bypass has nothing to grant. A4's admin-shaped token, meanwhile,
genuinely has `admin: true`, so it never exercises the bypass branch either. The gap: no case in
either file combined "not admin" + "allowlisted" + "a real, grantable roles claim" — the one
combination that actually surfaces the bug, because there's finally something for the bypass to
grant.

Case (5) closes it: `admin` absent, `email_verified: true`, an email that **is** on
`ADMIN_EMAIL_ALLOWLIST`, **and** a live `{'*': ['owner']}` roles claim, checked against the same
generous show window, across all seven capabilities — must still refuse every one. Verified against
the actual mutation QA described (not merely written and assumed correct): applying it to
`lib/admin-auth.ts` made case (5) fail on exactly the token/capability combination the mutation
opens up (all seven capabilities reported "returned true, expected false"), while cases (1)-(4)
and A4 kept passing — case (5) is the only one of the nine A3/A4 checks that isolates "the admin
claim is required" from "the capability set happened to be empty anyway, for an unrelated reason."
Reverting the mutation restored a clean pass. This is precisely the defect shape
`contracts/golden/ticketing-f4-roles-claim/README.md`'s A3(e) already had to fix once: a set of
cases that each vary one dimension while holding constant the very thing needed to actually
exercise the branch under test. Worth checking for explicitly on any future contract that claims
to prove a boolean gate is "genuinely consulted" — a case that varies the gate's input without also
giving the rest of the function something to act on proves nothing.

**A4** (`check-admin-token-not-vacuous.mjs`) is the guard the brief calls for explicitly: A3's
refusal proves nothing on its own if `hasCapability()` always returns `false` for everyone (a
broken implementation, or a stray `return false` above the real logic). A4 runs the *same* two
functions, with the *same* harness shape, against a genuinely admin-shaped token carrying an
`owner` role grant, and asserts the full capability set is resolved and every capability is
granted. If A4 ever fails while A3 passes, A3's refusal is meaningless and must not be trusted.

## The HTTP round trip — what's automated, what's manual, and why

The mission brief's "Done" wants: *"sign up as a public buyer, create a `buyers` document for that
`uid`, then attempt `POST /api/admin/checkin` with that account's session — must fail with 403,
not succeed, not return a different error code."* This section states, explicitly, what this
contract can and cannot prove of that sentence on this machine, offline.

**Why no Firebase Auth emulator.** The architect brief asked this contract to check whether the
Firebase Auth emulator is genuinely available before assuming it. It is not, in the sense that
matters for a gate: `firebase.json` in this repo has no `emulators` block at all, and
`firebase-tools` is not a pinned project dependency in `package.json` — only a global `firebase`
CLI binary (`/opt/homebrew/bin/firebase`, v15.15.0) happens to exist on this development machine.
Running `firebase emulators:start --only auth` for the first time downloads emulator binaries over
the network and needs a Java runtime; neither is something a network-free, credential-free gate
run on an arbitrary machine (or CI) can rely on. Pinning `firebase-tools` and an `emulators` block
purely to make this one contract's assertion pass would be a real infrastructure change outside
F5's brief, and would still leave the *first* run of any gate needing network access to fetch the
emulator JARs — which the mission's own standing rule (every assertion runs offline) rules out.
Building that infrastructure, if wanted, is a decision for a future feature, not something to bolt
onto F5's contract to manufacture a false sense of completeness.

**What A5 (`check-http-checkin-fails-closed.sh`) DOES prove, over a real HTTP round trip against a
real, running Next.js server, on the real compiled `POST /api/admin/checkin` route:**
1. No session cookie at all → `401`. This is the "unauthenticated" negative control the brief
   asks for explicitly.
2. A syntactically-plausible but cryptographically worthless session cookie → `401`, never `200`,
   never `500`. This proves the route fails closed on any unverifiable session — it never crashes
   into an accidental grant, and it never silently succeeds.
3. The refusal body is checked to contain the route's real JSON error shape (`error`/`Unauthorized`),
   not a generic Next.js framework error page — proving the request genuinely reached
   `app/api/admin/checkin/route.ts`'s real code, not a 404 or a dev-server placeholder.

The server is started with `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
`FIREBASE_ADMIN_PRIVATE_KEY`, and every `NEXT_PUBLIC_FIREBASE_*` variable explicitly overridden to
empty strings in the child process's environment — not merely "hoping `.env.local` is absent." This
means the check's "no live credentials" claim holds regardless of what secrets happen to be sitting
in `.env.local` on whichever machine runs the gate.

**What A5 does NOT prove, and why it can't, offline:** the brief's actual scenario — a *genuinely
authenticated* buyer session (a real Firebase-Auth-minted session cookie, for an account with no
`admin` claim) refused with `403` specifically, as distinct from `401` for no session at all — and
the paired positive control (a real admin session succeeding, so the `403` isn't vacuous against a
route that's simply broken). Both require a live Firebase Auth project to mint a real ID token and
exchange it for a real session cookie via `getAdminSession()`'s real `verifySessionCookie()` call.
There is no way to produce that cookie without live credentials; fabricating one (e.g. a JWT signed
with a fake key) would only prove the route rejects an obviously-forged token, not that it correctly
distinguishes a *real, valid, non-admin* session from a *real, valid, admin* session — which is the
actual property at stake. Manufacturing a mock of `verifySessionCookie()` would mean testing a
parallel reimplementation instead of the real route, which the brief explicitly rules out.

**This is the same class of gap F4's own contract documented and deferred** (see
`contracts/golden/ticketing-f4-roles-claim/README.md`, "What this contract does NOT prove" — the
live grant/revoke round trip against a real Firebase project). Consistent with that precedent, and
with the mission's own established pattern (F13 is where the *first* live, HTTP-round-trip-with-
negative-control proof against the deployed host is run and recorded), F5's live buyer-vs-admin
403/200 round trip is a **manual step**, not a contract assertion. No later F-item in the mission
file names buyer-account security as its subject, so this step is not silently folded into F5's
automated gate nor silently dropped — it is named here as an explicit manual procedure, to be run
once self-signup and a `buyers` document exist for a test account:

> **Manual verification procedure (owner: whoever first exercises buyer self-signup — likely
> alongside F6 or F14, since neither of those is buildable without a real buyer account to test
> against):**
> 1. Self-register a test buyer account via whatever public signup surface exists at that point
>    (or, if none exists yet, via the Firebase Auth REST `signupNewUser` API directly against the
>    real project), verify its email, and create a `buyers/{uid}` document for it.
> 2. Mint a session cookie for that account the same way the real signed-in flow would (via
>    whatever `/api/session` (or equivalent) endpoint mints admin session cookies today — the
>    buyer's account goes through the identical mint path, since nothing about it is
>    admin-specific).
> 3. `POST https://dev.saoc.co.za/api/admin/checkin` with that buyer's session cookie attached.
>    Record the response status and body. **Must be `403`.**
> 4. As the paired positive control (without which step 3's `403` proves nothing — see A4's
>    reasoning above, now applied to the live route instead of the offline function): repeat step
>    3 with a real admin session cookie for an account holding `scan-checkin`. **Must succeed**
>    (`200`, or whatever this route's real success shape is at that point).
> 5. Record both outcomes in the mission's session log. If step 3 ever returns anything other than
>    `403` (particularly `200`), stop and treat it as a live security incident, not a contract
>    failure to fix later — the boundary this section exists to prove has been breached for real.

### Why `check-env-scrub-effective.mjs`, not a shell-level re-check

QA mutation-tested A5 by deleting `FIREBASE_ADMIN_PROJECT_ID` from the shell script's credential
scrub list. **A5 still PASSED.** Root cause: A5 only inspects HTTP status codes and response
bodies, neither of which changes when a real Firebase credential leaks into the server's
environment — and this machine's `.env.local` genuinely holds three real `FIREBASE_ADMIN_*`
values, so the leak QA's mutation opened up was real, not hypothetical.

The first fix attempted here was a shell-level re-check: build the launch's env-override array,
then re-print it with `env "${overrides[@]}" env` and assert each name comes back empty. That
check is tautological — it only proves bash's own array-to-`env`-prefix construction works
syntactically; it can never observe whether `.env.local`'s real value would have reached the
*actual* running Next.js process, because that value is injected by Next's own dotenv-style
loader **after** process start, not by anything visible in the OS environment the shell script
constructs beforehand. A var deleted from the same array used for both the check and the launch
disappears from both simultaneously — the check would keep passing forever.

The real fix, `check-env-scrub-effective.mjs`, calls the **actual function Next.js itself calls at
startup** to load `.env.local` — `loadEnvConfig()` from `@next/env`, resolved via
`require.resolve('@next/env', { paths: [nextPkgDir] })` starting from `next`'s own package
directory (the same package `next/dist/server/config.js` resolves it from at
`(0, _env.loadEnvConfig)(dir, phase === PHASE_DEVELOPMENT_SERVER, curLog)`) — not a hardcoded pnpm
store path, so it keeps resolving correctly across a future `next` version bump. `@next/env` is
already an installed transitive dependency of `next` (confirmed present at
`node_modules/.pnpm/@next+env@16.2.12/`); nothing new was added. The script runs this real
loader in the repository's working directory (so it reads the real `.env.local`) with the
**identical env prefix** the shell script is about to hand to `next dev`, then checks an
**independently hard-coded** list of the nine credential variable names for emptiness —
independent specifically so that deleting a name from the shell script's `SCRUB_VARS` cannot also
silently shrink what gets checked.

Verified, not just written: run with the real, complete `SCRUB_VARS`, all nine variables come back
empty and A5 passes end-to-end with no orphaned process afterward (`lsof -i :<port>` and
`ps aux | grep 'next dev'` both empty). Run with `FIREBASE_ADMIN_PROJECT_ID` deleted from
`SCRUB_VARS` — QA's exact mutation — the script fails loudly and by name before the server is
even started:

```
FAIL: the credential scrub did not hold -- the following variable(s) are NON-EMPTY after the real
Next.js env-loading path ran (values withheld, names only): FIREBASE_ADMIN_PROJECT_ID. This means
.env.local's real value reached process.env because the launch's env prefix did not pre-set an
empty override for it.
```

No value is ever printed on either path — only variable names — per this project's standing rule
against logging secrets (four prior incidents). Reverting the mutation restored a clean pass, with
`lsof`/`ps` confirmed empty afterward. Because this check runs and fails **before** `SERVER_PID` is
ever assigned, a failure here never starts a server in the first place — nothing to leak, nothing
to clean up.

## No Firestore writes, no fixtures, nothing to leak

Every check in this contract is either a pure function call (A2, A3, A4, A6) or an HTTP round trip
against a Next.js server started fresh, with FIREBASE_ADMIN_* scrubbed, and torn down at the end of
the same script (A5). **No check in this contract writes to Firestore, seeds a fixture, or reads
`.env.local`.** This is a deliberate response to the project's standing P1 incident (contract
checks leaking ~17 orphaned Firestore documents into live data; a sentinel corruption sitting on
the deployed site for three days) — rather than design a namespaced-fixture-plus-cleanup-sweep
scheme for this contract, F5 simply has nothing that needs one, because nothing here ever touches
live data. A5's only side effect is a local Next.js dev server process, started inside its own
process group via bash job control (`set -m`, not `setsid` — see "Why bash job control, not
setsid" below) specifically so a `trap ... EXIT INT TERM` can `kill -TERM`/`kill -KILL` the whole
group on any exit path, including a signal that interrupts the script mid-run — a killed A5 leaves
no orphaned server process, only (at worst) a port briefly held by a dying process, which
self-clears.

### Why bash job control, not `setsid` — and how it was verified, not just asserted

The first version of `check-http-checkin-fails-closed.sh` used `setsid` for process-group
isolation. `setsid` is GNU coreutils and does not exist on darwin/BSD (`which setsid` returns
nothing on this project's own development machine, a Darwin/arm64 box — the gate never ran
because the server never started; the script died on `setsid: command not found` before binding
the port, so the timeout looked like a refusal-behaviour failure when it was actually "nothing
ran at all"). Adding a new system dependency (`brew install util-linux`) to fix this would be
exactly the class of problem this README already ruled out for the Firebase emulator above — a
check that only works because of an unpinned global binary happening to be present on one
machine is not a portable gate.

The fix is bash's own job control, which is POSIX and ships with every bash on every platform
this project targets: `set -m` before backgrounding the server job makes bash assign that job
its **own** process group, with `pgid == $!` (the leading process's pid) — on GNU/Linux bash
identically to BSD/darwin bash. `kill -TERM -- -$SERVER_PID` then signals the whole group. A
`pkill -P "$SERVER_PID"` sweep is layered underneath as a defensive fallback, not the primary
mechanism.

This was verified empirically on this machine before being reported fixed, not asserted from
reading the bash manual:
- A standalone two-job test (`set -m` backgrounding two `sleep 60` jobs) confirmed each job gets
  its own distinct pgid, and `kill -TERM -- -$PID` for one job's pgid terminates only that job,
  leaving the other running — proving job-control grouping is real and correctly scoped, not a
  side effect that happens to kill everything.
- A nested-shell test (`bash -c 'bash -c "sleep 60" & wait' &`) confirmed a grandchild process
  (two levels deep, the same depth as `env` → `pnpm` → `next dev`'s own children) inherits the
  job's pgid and is killed by the same `kill -TERM -- -$PID` — proving the mechanism reaches
  Next.js's actual child processes, not just the immediate `env`/`pnpm` wrapper.
- The real golden script was then run end-to-end twice in a row (PASS both times, ~3-5s each —
  see "A5 readiness timing" below) with `lsof -i :41733` and `ps aux | grep 'next dev'` checked
  immediately after each run: both came back empty — no held port, no orphaned process.
- A third run was interrupted mid-flight with an external `SIGTERM` sent to the *script's own*
  PID (simulating a gate-level timeout kill, the exact failure mode `subprocess.run(timeout=...)`
  in `execution/contract.py` produces — Python's `timeout` kills the immediate child, not a shell
  script's own grandchildren, which is precisely why this script cannot rely on the harness for
  cleanup and must do its own). The `trap ... EXIT INT TERM` fired, and the same `lsof`/`ps`
  check immediately after came back empty again — no orphan survives an interrupted run either.

### A5 readiness timing

The original 60-second readiness poll was a guess, not a measured number, and was too tight for
a cold Next.js dev compile on this project (Next only compiles a route on its first request).
The poll is now 150 seconds, with `timeout_seconds: 220` set on the contract assertion itself
(readiness poll + the three follow-up `curl` calls + cleanup, with margin) — a flaky assertion
that sometimes times out on a cold cache is worse than an honestly slower one. In practice, on
this machine, with the route's compiled output already cached from a prior `next dev` run in this
same checkout, both real runs above completed in 3-5 seconds; the 150s ceiling exists for the
genuinely cold case (a fresh checkout, `.next` cache absent) and was not itself re-measured from
an emptied cache in this pass, since deleting `.next` is blocked by this project's own tooling
guard against recursive deletes — the 150s figure is therefore a conservative bound carried over
from the original design intent, not a re-verified cold-start number, and should be revisited if
it ever proves too tight in a genuinely cache-cold environment (e.g. CI).

## Every assertion and its defeating mutation

- **A1 (`pnpm type-check`).** Defeated by a type error anywhere in `lib/buyers.ts` or the
  `Order.buyerUid` addition.
- **A2 (compiler fixture).** Defeated by: widening/narrowing `NewsletterOptIn` or `Buyer`'s shape
  away from the golden spec; making `Order.buyerUid` required (the omitted-field literal stops
  compiling); or typing `buyerUid` as something other than `string | null | undefined`.
- **A3 (buyer resolves to the empty capability set).** Defeated by any implementation where a
  token with no `admin`/`roles` claim resolves a non-empty capability set for any of the seven
  capabilities, on any showId, under any date-window state — including the narrower mutants it
  specifically targets: treating `admin: false` differently from `admin` absent, granting based on
  `isEmailAllowlisted(email)` rather than `admin === true`, and — case (5), added after QA found
  cases (1)-(4) survive this exact mutation (see "Why case (5) exists" above) — bypassing the
  admin gate for a non-admin, allowlisted-email token that also carries a real, grantable
  `{'*': ['owner']}` roles claim.
- **A4 (admin control, not vacuous).** Defeated by `hasCapability()`/
  `resolveRoleCapabilitiesForShow()` failing to grant capabilities to a genuinely admin-shaped
  token with an `owner` grant — which would mean A3's buyer refusal is meaningless (a
  perpetually-`false` function passes both A3 and a broken A4 differently: A4 is specifically the
  one that would catch that).
- **A5 (HTTP fails closed).** Defeated by: `POST /api/admin/checkin` returning anything other than
  `401` for a request with no session cookie; returning `200` or `500` (rather than `401`) for a
  garbage session cookie; or returning a response body that isn't the route's real JSON refusal
  shape (which would mean the request never reached the real route code, e.g. a 404 masquerading
  as a pass because it happens to also return a non-2xx status). Its "(0)" preflight is separately
  defeated by any of the nine `FIREBASE_ADMIN_*`/`NEXT_PUBLIC_FIREBASE_*` variables being non-empty
  after the real `loadEnvConfig()` run — including, specifically, a variable name silently dropped
  from `SCRUB_VARS` (see "Why `check-env-scrub-effective.mjs`, not a shell-level re-check" above,
  QA's original finding that this mutation survived before the fix).
- **A6 (newsletter consent defaults).** Defeated by: `buildNewsletterOptIn()` with no argument
  producing anything other than fully-unticked/null; a genuine opt-in failing to record either
  `optInAt` or `source`; `optedIn: false` leaking a non-null `optInAt` or `source` when a caller
  passes them anyway; or `buildBuyerDocument()`'s default newsletterOptIn being anything other than
  unticked, or the built document carrying a `roles` or `admin` field.
- **A7 (`pnpm lint`).** Defeated by any lint violation in the new/edited files.

## What this contract does NOT prove

- **The live, buyer-vs-admin HTTP round trip with real Firebase-Auth-minted session cookies** —
  see "The HTTP round trip" above. This is the single largest gap between this contract and the
  mission brief's literal "Done" wording, and it is a live-credential requirement inherent to the
  property being tested, not a shortcut this architect chose to skip. It's assigned to a named
  manual procedure above rather than to a specific F-item, because no existing F-item in the
  mission owns buyer-account security as its subject; whoever first builds a real buyer signup
  surface (F6 or F14) should run it as part of that work, and it should be re-run at least once
  against the deployed host, not only `dev.saoc.co.za`, per the mission's standing rule that local
  and deployed behaviour have diverged expensively before.
- **§8.4(2): no public buyer-facing route may ever consult `lib/admin-roles.ts` or check any admin
  capability.** No public buyer-facing route exists yet — F5 builds no route, `/tickets/recover`
  and `/tickets/resend-my-tickets` are F6, `/my-tickets`/account pages are later or unscoped. This
  property has nothing to test against yet. It is recorded here as a standing requirement for F6
  and F14's own contracts to prove when those routes are built, not silently assumed satisfied by
  F5.
- **§8.4(3): no admin route may ever grant access based on the mere existence of a `buyers`
  document.** Same reasoning — no admin route reads the `buyers` collection at all yet (nothing in
  F5's scope adds that read). This is a property about code that doesn't exist yet; it becomes
  testable, and should be tested, the moment any future feature makes an admin route touch the
  `buyers` collection for any reason (e.g. an admin "look up this buyer's order history" tool).
- **The guest-order-claiming backfill (spec §8.3).** Explicitly out of scope per the mission
  brief ("the backfill itself is not F5"). `buyerUid` exists as a field with the right type and
  defaults to unset on every pre-F5 order; nothing in this mission's current feature list (F1-F14)
  names the backfill as its subject. This is a real scope gap worth flagging to Brad/the
  orchestrator before M1 is considered fully closed, not something this contract can silently
  paper over by inventing an assertion for code that isn't being built.
- **That the Firestore security rules (if/when written) independently prevent a client SDK from
  reading another buyer's `buyers/{uid}` document.** This contract proves the *server-side*
  authorization decision (`hasCapability`) is correct; it says nothing about Firestore rules,
  which are a separate enforcement layer not in F5's brief and not yet written anywhere in this
  repo (no `firestore.rules` file exists in this project as of this contract).
- **British-English prose in in-repo comments is not separately gated by this contract** beyond
  what `pnpm lint` catches, matching F4's own precedent.

## Judgement calls made that the brief left open

1. **Module name and exact function signatures for `lib/buyers.ts`.** The brief names the
   collection and its fields but not the module's shape. Named and shaped to mirror F3/F4's
   established pattern (`lib/admin-roles.ts`'s pure `resolve()`, `lib/admin-auth.ts`'s pure
   `resolveRoleCapabilitiesForShow()`): a pure, side-effect-free construction module that a future
   signup route calls, rather than inlining the consent-defaulting logic at the call site where it
   would be easy to get subtly wrong per caller.
2. **`buildNewsletterOptIn`'s `optedIn: false` branch actively zeroes `optInAt`/`source` rather
   than only defaulting them when absent.** Chosen specifically to make the "leaked timestamp
   without real consent" mistake impossible to construct, not merely unlikely — see "Why
   `buildNewsletterOptIn` forces..." above. A weaker design that merely *documented* "don't pass
   source unless optedIn is true" would rely on every future caller reading and obeying a comment.
3. **The manual HTTP round-trip procedure is written here, in F5's own golden README, rather than
   proposing a new mission F-item.** Architect scope is to design F5's contract, not to edit the
   mission file's feature list — adding a new F-item is the orchestrator's/Brad's call. Recording
   the procedure here means it isn't lost, and flagging the ownership gap explicitly (rather than
   silently assuming F6 or F14 will pick it up) is the safer failure mode.
4. **No Firestore security rules file is addressed by this contract.** Out of scope per the same
   reasoning as item 3 above — rules-writing isn't named in F5's brief, and inventing an assertion
   against a file that doesn't exist in this repo would be testing nothing.

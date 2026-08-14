---
schema: athanor.mission/v1
slug: admin-auth-hardening
goal: Close the proven /admin authentication hole, then add Google, Microsoft and
  Apple sign-in safely on top of a working authorisation gate
created_at: '2026-08-14T13:50:58.639386+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 6
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  title: Authorisation gate — allowlist or custom claim, enforced server-side, failing closed
  inline_brief: 'PREMISE CORRECTED 2026-08-14 by live test against the deployed host.
    Five of six surfaces ALREADY check a custom claim (app/admin/page.tsx:24,
    api/admin/tickets:25, checkin:27, export-csv:32) and correctly return 403 / 307 to
    a self-registered account. Admin DATA was never reachable. The real gaps are
    narrower and specific:

    (a) POST /api/admin/session mints a session cookie for ANY valid idToken — measured
    200 with a cookie issued for a freshly self-registered account. No claim check.
    (b) app/admin/door/page.tsx is a client component with no server gate and there is
    no middleware.ts, so the scanner UI renders to anyone unauthenticated (check-in
    POSTs still 403, so this is UI exposure, not check-in capability).
    (c) NO ALLOWLIST governs who may hold the admin claim — grant/revoke is undefined.
    (d) Open self-signup at the Identity Platform level.

    Do not rewrite the five working claim checks for the sake of uniformity; make them
    read from one shared helper so the allowlist has a single home, and close (a)–(d).

    Approach: a custom claim (e.g. admin:true) set by an out-of-band path, checked
    server-side on every admin surface, with an explicit allowlist of permitted email
    addresses as the source of truth for who may hold that claim. Fail CLOSED on every
    unenumerated state — missing claim, malformed claim, revoked session, claim present
    but email no longer on the allowlist.

    Surfaces to cover, all of them: app/admin/page.tsx, app/admin/door/page.tsx,
    app/api/admin/tickets/route.ts, app/api/admin/checkin/route.ts,
    app/api/admin/export-csv/route.ts, app/api/admin/session/route.ts. Missing one
    leaves the hole open; the CSV export alone leaks the full buyer list.

    The session route deserves particular thought: it currently mints a session cookie
    for any valid idToken. Refusing to mint a session for a non-allowlisted identity is
    the cleanest choke point, but the per-route checks must still exist — defence in
    depth, not a single gate.'
  status: pending
  milestone: M1
- id: F2
  title: Adversarial proof that a self-registered account is refused everywhere
  inline_brief: 'The assertion that closes this mission. A source-grep is NOT evidence
    — this project has a documented history of false-green assertions, and
    contracts/contract-d5-admin-dashboard.yaml D5-04 is a live example: it greps for
    "admin" plus "claim|role|verifySessionCookie" in one file, which cannot distinguish
    a real authorisation check from an incidental mention. It passed throughout. Replace
    it as part of this feature.

    A MEASURED BASELINE now exists (2026-08-14, deployed host): session route 200 +
    cookie issued, /api/admin/tickets 403, /api/admin/export-csv 403, /admin 307 to
    login, /admin/door 200. The test must assert the two failures flip and the four
    passes STAY passing — a fix that breaks a working gate is a regression.

    Reproduce the original attack exactly: create an account via an unauthenticated
    POST to identitytoolkit.googleapis.com/v1/accounts:signUp using the PUBLIC web API
    key, exchange it for a session, then attempt EVERY admin surface over real HTTP and
    assert each returns 401/403 and no data. Then delete the probe account and assert
    it is gone.

    The test must also prove the gate does not simply refuse everyone: an allowlisted
    account must still succeed. A guard that blocks all access passes a
    refuse-the-attacker test while breaking the product.

    Include a negative control proving the test can FAIL — run it against the current
    (unfixed) code path or a deliberately weakened gate and confirm it reports failure.
    A test that cannot fail proves nothing.

    Every check needs an explicit timeout_seconds; the 60s default has caused four live
    incidents by SIGKILLing checks mid-run.'
  status: pending
  milestone: M1
- id: F3
  title: Admin account provisioning — a documented, repeatable way to grant and revoke
  inline_brief: 'Granting admin cannot be "Brad remembers a console click". Needs a
    documented procedure and a script: add an email to the allowlist, set the claim,
    and — equally important — REVOKE, including revoking existing sessions so a removed
    committee member loses access immediately rather than in five days when the cookie
    expires (SESSION_DURATION_MS is 5 days).

    Consider disabling open self-signup at the Identity Platform level as defence in
    depth. It is not a substitute for F1 — the allowlist is the real control — but it
    removes the trivial attack path entirely and costs nothing.

    Document in docs/admin-access.md: who may hold admin, how to grant, how to revoke,
    and how to verify. The Council will eventually run this without us.'
  status: pending
  milestone: M1
- id: F4
  title: Google sign-in
  inline_brief: 'Cheapest of the three and safe ONLY once F1/F2 are green — before that
    it widens the hole from "anyone who can call an API" to "every Google account on
    earth".

    Near-zero configuration in Firebase (auto-configured; set the support email). The
    real work is in app/admin/login/page.tsx, which today implements only
    signInWithEmailAndPassword — enabling a provider in the console has NO effect until
    the login UI offers it.

    Verify the allowlist gate holds for a Google identity specifically: a Google account
    NOT on the allowlist must be refused with the same fail-closed behaviour as an
    unknown email/password account.'
  status: pending
  milestone: M2
- id: F5
  title: Microsoft and Apple sign-in
  inline_brief: 'Brad CONFIRMED on 2026-08-14 that he holds a paid Apple Developer
    Program membership, so the usual blocker (~$99/yr) is already paid and Apple is
    viable.

    Apple needs: a Services ID, a private key for Sign in with Apple, the Team ID, and
    the return URL registered against the Firebase auth domain. Apple also enforces
    private email relay — users may present a relay address rather than a real one,
    which interacts directly with an email-based allowlist. Decide how allowlisting
    works for relayed addresses BEFORE building, or committee members will lock
    themselves out.

    Microsoft needs an Azure/Entra app registration (tenant, client ID, client secret)
    plus the redirect URI. Decide whether to restrict to a specific tenant or allow any
    Microsoft account.

    Both are more configuration than code. Neither is required for the door scanner to
    work, so if either stalls, record it as blocked and ship the rest.'
  status: pending
  milestone: M2
- id: F6
  title: Door scanner and admin proven working end to end, by a human
  inline_brief: 'The payoff. The scanner and check-in logic have been gate-green but
    UNTESTABLE in every environment because Authentication did not exist on the project
    and the web API key was wrong — both fixed 2026-08-14.

    Log in as a real allowlisted admin on the DEPLOYED host, load the ticket list, and
    confirm the door scanner opens its camera. Full check-in verification (paid ticket
    admits once, second scan refused) depends on a paid ticket existing, which belongs
    to the sandbox-ticket-proof mission — record what is proven and what still is not
    rather than claiming the whole path works.

    Also test OFFLINE behaviour: put the phone in aeroplane mode and try to check in.
    The 2027 venue is an aerodrome and connectivity should not be assumed. Whatever
    happens, record it — this is currently unknown for every option researched, ours
    included.

    Known caveat: createSessionCookie requires the service account to hold the Service
    Account Token Creator role. If login succeeds but session creation returns 401, that
    is the cause.'
  status: pending
  milestone: M3
milestones:
- id: M1
  title: The hole is closed and proven closed
  features:
  - F1
  - F2
  - F3
  status: pending
- id: M2
  title: Google, Microsoft and Apple sign-in, on top of a gate that holds
  features:
  - F4
  - F5
  status: pending
- id: M3
  title: A human logs in and the door scanner runs
  features:
  - F6
  status: pending
---

# Mission: Close the /admin auth hole, then add sign-in providers safely

## Why this mission exists

> **PREMISE CORRECTED 2026-08-14.** This mission was written on the claim that a self-registered
> account could reach the buyer list, the CSV export and the door scanner — a POPIA
> notifiable-breach shape. That claim was an **inference** from a successful `accounts:signUp`;
> the chain was never tested to the asset. Re-tested end to end against the deployed host the
> same day, it does not hold. **Admin data was never reachable.** The section below records what
> is actually true.

Measured against `https://saoc-prod--saoc-webapp.europe-west4.hosted.app` with a freshly
self-registered account (both probe accounts deleted and verified gone afterwards):

| Surface | Result |
|---|---|
| `accounts:signUp` via the public web API key | account created — self-signup is open |
| `POST /api/admin/session` | **200, session cookie issued** — no claim check |
| `/api/admin/tickets` | 403 Forbidden |
| `/api/admin/export-csv` | 403 Forbidden |
| `/admin` | 307 → `/admin/login` |
| `/admin/door` | **200, scanner UI renders** |

Five of six surfaces already check `decodedToken.admin === true || role === 'admin'`. What
remains genuinely broken is the ungated session route, the ungated door page, the absence of any
allowlist governing who may hold the claim, and open self-signup.

**The project has zero auth accounts and zero admin claims.** `/admin` is inaccessible to
everyone, including Brad — that, not a breach, is why the door scanner has been untestable in
every environment. Provisioning (F3) is the unblocker, and it is the reason the mission still
leads with the gate rather than the providers: F1/F3 define who may hold the claim, and adding
Google before that means defining it for every Google account on earth.

**Method lesson, recorded because it cost a wrong severity call:** a successful first step is not
proof of the last step. Test the whole chain to the asset before recording severity.

## What changed on 2026-08-14 that makes this possible now

Two independent faults had kept `/admin` dead in every environment, and only one was recorded:

1. Firebase Authentication had **never been initialised** on `saoc-webapp` — the probe returned
   `CONFIGURATION_NOT_FOUND`. Brad enabled Email/Password during that session.
2. The Firebase web API key was **wrong everywhere** — `...CRX7O5OYTH6...` (letter O) where the
   issued key is `...CRX705OYTH6...` (digit zero). An eye-transcription slip present in
   `.env.local`, `apphosting.yaml`, `ci.yml` and four contract goldens. Fixed in `48b564c`,
   verified against `firebase apps:sdkconfig WEB --project saoc-webapp`.

That was the fourth incident in the documented secret-corruption class. See
`docs/secret-corruption-incidents.md`.

## Scope discipline

- **The gate comes first.** No provider work begins until F1 and F2 are green.
- **Do not accept source-greps as proof.** Every security assertion is a real HTTP round trip
  against a running server, with an explicit `timeout_seconds`.
- **Every check needs a negative control.** A test that cannot fail proves nothing — this
  project has shipped false-green assertions before, including one where a live "must not
  contain" assertion failed OPEN on an auth error.
- **Do not touch `app/api/tickets/itn/route.ts`** — it is sha256-pinned and changing it requires
  the documented re-pin ceremony.
- **Design folders** (`branding/`, `design spec/`, `design/Claude Design HTML/`) are Brad's
  active workstream. Leave them alone.

## Known constraints

- `createSessionCookie` requires the Admin service account to hold **Service Account Token
  Creator**. If login succeeds but session creation 401s, that is the cause — not the gate.
- Session cookies last **5 days** (`SESSION_DURATION_MS`), so revocation must explicitly revoke
  existing sessions, not merely remove the allowlist entry.
- Apple's **private email relay** interacts badly with an email-based allowlist. Settle that
  before building F5.
- The login page (`app/admin/login/page.tsx`) implements only `signInWithEmailAndPassword`.
  Enabling providers in the console changes nothing until the UI offers them.

## Relationship to other work

`sandbox-ticket-proof` is paused, not abandoned. Its F3 (one human sandbox purchase on the
deployed host) and F5 (door admission) were blocked on exactly the Auth problem this mission
addresses. Once M3 here is green, that mission can resume properly.

Two P1 items surfaced by the payment-gateway research are queued behind this and are NOT in
scope here: ticket delivery (no confirmation email exists and nothing generates a QR code, so
the scanner has nothing to scan), and refund state in the data model. Both are in `backlog.md`.

## Notes

- Dev server runs on port 3333, reachable at `https://dev.saoc.co.za` (`pnpm dev:secure`).
- Test security behaviour against the DEPLOYED host as well as locally — the two have diverged
  before, expensively.

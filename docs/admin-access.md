# Admin access — authorisation gate

**Code:** [`lib/admin-auth.ts`](../lib/admin-auth.ts) — the single home for the admin
authorisation decision. Six surfaces call it; nothing else decides who is an admin.
**Contract:** [`contracts/contract-admin-auth-hardening.yaml`](../contracts/contract-admin-auth-hardening.yaml),
mission `admin-auth-hardening`, features F1+F2. Golden spec:
[`contracts/golden/admin-auth-hardening/admin-auth-gate.golden.md`](../contracts/golden/admin-auth-hardening/admin-auth-gate.golden.md).

## What the gate does, and why it exists

Before this work, `POST /api/admin/session` minted a session cookie for **any** valid
Firebase idToken — no claim check — and `/admin/door` rendered the door-scanner UI to
anyone who hit the URL, unauthenticated. Both were confirmed exploitable. This gate
closes both holes by giving every admin-facing surface one shared, allowlist-backed
decision instead of six separate (and previously inconsistent) checks.

## The policy

A caller is an admin if, and only if, **all three** hold, re-checked on every request:

1. The decoded Firebase ID token / session cookie carries `admin === true` as a custom
   claim (strict boolean check — there is no `role` claim fallback; nothing in this repo
   ever sets a `role` claim, so that branch was dead attack surface and was removed).
2. `email_verified === true` on that same token.
3. The token's email is a live member of `ADMIN_EMAIL_ALLOWLIST` (comma-separated env
   var), lower-cased and trimmed, checked against the **current** value of the env var at
   request time — not cached, not baked in at claim-mint time.

Anything not covered by this — missing claim, malformed token, no session cookie,
expired/revoked session — **fails closed**. There is no default-allow branch anywhere in
`lib/admin-auth.ts`.

### Where it's enforced

| Surface | How |
|---|---|
| `app/admin/page.tsx` | `getAdminSession()`; redirects to `/admin/login` on any non-ok result |
| `app/admin/door/layout.tsx` | Server-component layout gating the `/admin/door` subtree only (see below) |
| `app/api/admin/session/route.ts` | `isAdminToken()` — refuses to mint a cookie for a non-allowlisted identity |
| `app/api/admin/tickets/route.ts` | `getAdminSession()` — 401 for no/invalid session, 403 for every other refusal |
| `app/api/admin/checkin/route.ts` | Same pattern; auth runs before anything is read from or written to Firestore |
| `app/api/admin/export-csv/route.ts` | Same pattern |

`/admin/door` is gated by its own `layout.tsx`, scoped to that route subtree — not by
gating `/admin` itself, because `/admin` also has to serve `/admin/login`, and gating the
login route would brick sign-in entirely.

### `/admin/login` is deliberately ungated

`app/admin/login/page.tsx` has no server-side gate in front of it. This is intentional,
not an oversight: the login page is how a session cookie gets minted in the first place,
so gating it would make it impossible to ever sign in. It's safe to leave open because it
does nothing privileged by itself — it only calls Firebase client-side sign-in and then
`POST /api/admin/session`, which is the surface that actually enforces the policy above.

## Reading the `reason` field when debugging

`getAdminSession()` never throws. On refusal it returns one of:

| `reason` | Meaning |
|---|---|
| `no-session` | No `session` cookie present on the request |
| `invalid-session` | Cookie present but failed `verifySessionCookie` (expired, revoked, malformed) |
| `no-claim` | Session verified, but `admin` custom claim is not `true` |
| `email-unverified` | `admin` claim is `true`, but `email_verified` is not `true` |
| `not-allowlisted` | Claim and verification both pass, but the email isn't (currently) in `ADMIN_EMAIL_ALLOWLIST` |

`no-session` / `invalid-session` map to HTTP 401 on the API routes; the other three map
to 403. All five look like an undifferentiated "you can't in" from outside — the `reason`
is what actually tells you which precondition failed, so check it (server logs / debugger)
before assuming the allowlist or the claim is wrong.

## Traps that will cost you a day if you don't know about them

### 1. The lockout trap — email/password signup does not verify email

Firebase's standard email/password `createUserWithEmailAndPassword` flow does **not**
set `email_verified: true`. An admin account created that way will be refused with
`reason: 'email-unverified'` even if it correctly holds the `admin` claim and is on the
allowlist — and from outside, that refusal looks identical to "not allowlisted." When
provisioning an admin account, either set `emailVerified: true` explicitly via the
Firebase Admin SDK (`getAuth().updateUser(uid, { emailVerified: true })`) or drive a real
email-verification flow. Don't assume "I set the custom claim" is enough.

### 2. The empty-allowlist trap — a parsing failure is invisible from outside

`ADMIN_EMAIL_ALLOWLIST` is a comma-separated string. A stray comma, whitespace, or a
value that didn't actually land in the deployed environment produces an **empty** parsed
list, which fails closed for every single identity — including a correctly provisioned
admin — and looks, from outside, exactly like a gate that's simply working as intended
(everyone gets refused). `lib/admin-auth.ts` logs the parsed allowlist **length only**
(never the values — see the project's no-secrets-in-logs rule) once per server process:

```
[admin-auth] ADMIN_EMAIL_ALLOWLIST parsed length: 0
```

A `0` there is the unambiguous signal. This project has four prior documented
secret-corruption incidents, all from a value being moved or copied without anyone
verifying it still functioned afterwards — see
[`docs/secret-corruption-incidents.md`](secret-corruption-incidents.md). The lesson
applies directly here: **after setting or changing `ADMIN_EMAIL_ALLOWLIST` on any
deployed host, confirm it by actually signing in as an allowlisted identity and reaching
`/admin`.** Confirming the secret exists in Secret Manager / the env is not sufficient —
it doesn't tell you the value parsed into a non-empty list, still less that the value is
correct.

### 3. `ADMIN_EMAIL_ALLOWLIST` is not currently set on the deployed host

As of this writing, the deployed environment has no `ADMIN_EMAIL_ALLOWLIST` value, so
`/admin` currently refuses **everyone**, with no exceptions. This is expected and
correct, not a bug to chase — it's the fail-closed default behaving exactly as designed.
It will start working once provisioning (mission `admin-auth-hardening`, feature F3)
lands and sets a real allowlist against a real admin identity.

Relatedly: this project currently has **zero** Firebase Auth accounts and zero `admin`
custom claims anywhere. Nobody — allowlisted or not — can reach `/admin` today, because
there is no account for the allowlist check to ever reach. That's also F3's job.

## Running the contract gate

```bash
bash contracts/checks/admin-auth-hardening/server-ctl.sh start
# ... contract.py runs the checks in contracts/checks/admin-auth-hardening/ ...
bash contracts/checks/admin-auth-hardening/server-ctl.sh stop
```

`start` rsyncs the current working tree (including uncommitted changes — that's
deliberately what gets tested, never a stale committed snapshot) into an isolated
scratch directory, runs `pnpm install --frozen-lockfile` and `pnpm build` there, and
brings up a production server on `http://127.0.0.1:3400`, isolated from anything else
running in this checkout (in particular, from `pnpm dev:secure` on port 3333). `stop`
tears the scratch server and directory down.

The script holds an **exclusive lock** across concurrent invocations (this project runs
many agents at once, and two unsynchronised `start`s racing on the same fixed port/pidfile
previously produced failures that looked like security defects but weren't). If it
reports another run already holds the lock/port, **wait for it to finish rather than
killing it** — killing a concurrent run can leave the lock directory or scratch build in
a state the next `start` has to clean up by hand.

Preconditions the gate cannot supply itself — see the contract YAML's own header comment
for the full detail:
- `.env.local` at the repo root with the Firebase client/admin credentials.
- `ADMIN_EMAIL_ALLOWLIST` in that same `.env.local` including the check's fixture email
  (default `admin-auth-check-allowlisted@saoc.co.za`). Missing this makes several checks
  fail with a 403 that is indistinguishable from a real gate defect — this is the same
  trap as #2 above, just hitting the contract's own fixture instead of a real admin.

## Out of scope here (F3 / M2)

Grant/revoke tooling for the allowlist and custom claims, disabling open self-signup on
`/admin/login`, and adding Google/Microsoft/Apple sign-in providers are later work
(mission `admin-auth-hardening`, features F3 and beyond). This document covers only the
authorisation gate itself (F1/F2) as it exists today.

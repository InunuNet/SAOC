# F1 (admin-settings-deploy-and-chrome-fix) — design rationale

## The three problems, and why a structural grep alone is not enough

1. `/admin/settings` 404s on `beta.saoc.co.za` — the code from mission `ozow-sandbox-toggle` F1
   is gated locally (`gate_result: pass`, mission file `status: done`) but was never confirmed
   pushed-and-live. Root cause of the ORIGINAL bug: nothing in that mission's contract required
   proof of a live deploy, only a local gate.
2. `app/admin/settings/page.tsx` renders with no site chrome — confirmed by reading the file
   (2026-08-24): it returns a bare `<main>...</main>`, no `UtilityBar`/`Header`/`AdminNav`/
   `Footer`, unlike `app/admin/page.tsx` and `app/admin/vendors/page.tsx` which both wrap their
   content in the full chrome stack.
3. `components/admin/AdminNav.tsx`'s `buildLinks()` has no Settings entry — confirmed by reading
   the file (2026-08-24): only `dashboard`, `door`, and conditionally `vendors` exist.

**Why a structural grep on the source alone would not have caught the original bug and must not
be trusted alone here:** the ozow-sandbox-toggle F1 contract's own assertions were all structural/
offline (fail-closed flag reads, pure-function amount resolution — see
`.agent/memory/project/specs/ozow-sandbox-toggle/contract-m1-f1.yaml`), all genuinely passed, and
none of them could have detected "this route 404s in production" because none of them touched a
live URL. This project's own `.claude/rules/behavior.md` and this feature's dispatch brief are
explicit: a green structural check on `app/admin/settings/page.tsx` — even one that greps for
`<Header` — proves the JSX CALLS the component; it does not prove the route resolves, that the
capability gate doesn't redirect somewhere unexpected, that the deployed bundle actually contains
this code, or that the chrome renders without a hydration/runtime error only visible in a real
browser. That is exactly the failure mode `.claude/rules/workflow.md`'s Codex-review rationale and
the `ozow-m1-f3` mission's live-purchase protocol were both introduced to close. This feature
reuses that same two-layer pattern:

- **A structural assertion (A1-A3)** proves the SOURCE has the right imports/JSX/props — fast,
  cheap, catches an obviously-wrong diff before anything is deployed.
- **A live, artifact-backed BrowserAgent assertion (A6)**, gated behind a deploy-freshness proof
  (A5) that the structural fix has actually reached `beta.saoc.co.za`, is what proves the fix
  actually works. A1-A3 passing is necessary but explicitly NOT sufficient for this feature to be
  DONE — see the assertion list below; A6 is not optional or "nice to have."

## Why BrowserAgent's PASS/FAIL must be DOM-derived, not a screenshot judgment call

Per `.claude/rules/coding.md`'s verification hierarchy ("Human input is the last resort... every
`agent_review` assertion is a challenge: can this be automated?") and the identical reasoning
already applied in `contracts/golden/ozow-m1-f3/README.md` §1 (BrowserAgent's own prose summary
is not trusted as the source of truth — a structured artifact is), this feature's BrowserAgent
run must derive PASS/FAIL from real Playwright DOM assertions (element presence via selectors:
`UtilityBar`'s root, `<Header>`'s `<nav aria-label="Primary">` or equivalent, `<AdminNav
aria-label="Admin">`'s nav bar, the Settings `<Link>` with `href="/admin/settings"` inside it,
`<Footer>`'s root), not from the agent's own visual read of a screenshot. Screenshots are still
captured and stored (useful supporting evidence and required by the mission brief's "desktop
1440px + mobile 375px" instruction), but the PASS/FAIL boolean per check comes from
`page.locator(...).isVisible()` / `.count()` assertions the BrowserAgent script itself runs and
writes into the JSON artifact below — a `check-live-chrome.mjs` script then independently
re-derives the final verdict from that JSON, exactly mirroring `check-live-purchase.mjs`'s
"never trust the agent's chat output" design.

## Authenticating the BrowserAgent session against a live admin-gated route

`/admin/settings` redirects unauthenticated visitors to `/admin/login`, and non-capability-holders
to `/admin` (see `app/admin/settings/layout.tsx`). The BrowserAgent needs a real, valid `session`
cookie for a user who holds BOTH `admin:true` + verified + allowlisted (`isAdminToken`) AND the
`manage-payment-settings` capability (`hasCapability`), without driving the actual Google/Firebase
OAuth UI (no stored Playwright `storageState` exists for that — same gap already documented in
`contracts/f3-pin-singletons.yaml`, `contracts/f4-seed-page-singletons.yaml`, and
`contracts/f5-event-slugs.yaml`). Mint the session server-side instead, the same way
`app/api/admin/session/route.ts`'s own `POST` handler already accepts a bare `idToken` and returns
a `session` cookie:

1. Use the `FIREBASE_ADMIN_*` credentials already present in `.env.local` (see reference memory
   `reference-saoc-credentials-inventory` — check `.env.local` before asking Brad for anything) to
   call `getAuth(initAdmin()).createCustomToken(uid, { admin: true })`, where `uid` is a REAL,
   ALREADY-allowlisted admin's uid (Brad's own account — an existing owner-role user already
   satisfies `admin:true` + `email_verified:true` + present in `ADMIN_EMAIL_ALLOWLIST` +
   `roles['*']` including `owner`, which resolves to every capability including
   `manage-payment-settings` per `lib/admin-roles.ts`'s `owner: new Set(CAPABILITIES)`). Do NOT
   create a new sentinel/test Firebase Auth user for this — unlike `ticketing-hardening`'s
   `ADMIN_TEST_UID`, a synthetic user would also need to be manually added to
   `ADMIN_EMAIL_ALLOWLIST` in Secret Manager, a live production config change, to pass
   `isAdminToken`. Reusing an existing real allowlisted admin's `uid` (looked up by email via
   `getAuth(initAdmin()).getUserByEmail(...)`, never hardcoded) needs no config change and creates
   no residue.
2. Exchange the custom token for an ID token via the Identity Toolkit REST endpoint
   `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=<NEXT_PUBLIC_FIREBASE_API_KEY>`
   (already in `.env.local`), body `{ "token": "<custom token>", "returnSecureToken": true }`.
3. `POST https://beta.saoc.co.za/api/admin/session` with `{ "idToken": "<id token>" }`, capture
   the `Set-Cookie: session=...` response header.
4. Hand that cookie to the BrowserAgent (Playwright `context.addCookies([{ name: 'session',
   value, domain: 'beta.saoc.co.za', path: '/', httpOnly: true, secure: true }])`) BEFORE
   navigating — never drive the login form.

This mints a real, correctly-scoped, short-lived session using only credentials this project
already has server-side; it creates no new Firestore/Firebase Auth residue (no new user, no
allowlist change) and needs no interactive OAuth. `check-live-chrome.mjs` (A6) can either mint
this itself as a setup step, or a separate `mint-live-admin-session.mjs` helper can be dispatched
first — @dev's implementation choice, not fixed by this contract.

## The BrowserAgent artifact schema (A6)

Two runs required — desktop and mobile — same "two runs, independently checked" pattern as
`ozow-m1-f3`'s ozow/payfast pair. Written to
`.agent/memory/scratch/admin-settings-chrome-runs/<viewport>-<ISO-timestamp>.json`:

```json
{
  "viewport": "desktop",
  "widthPx": 1440,
  "url": "https://beta.saoc.co.za/admin/settings",
  "startedAt": "2026-08-24T12:00:00Z",
  "completedAt": "2026-08-24T12:01:10Z",
  "checks": [
    { "name": "page-loads-200", "pass": true, "detail": "response.status() === 200, not a 404 or redirect to /admin/login" },
    { "name": "utility-bar-present", "pass": true, "screenshot": "01-full-page.png", "detail": "UtilityBar root locator visible" },
    { "name": "header-present", "pass": true, "screenshot": "01-full-page.png", "detail": "Header root locator visible" },
    { "name": "admin-nav-present", "pass": true, "screenshot": "01-full-page.png", "detail": "nav[aria-label='Admin'] visible" },
    { "name": "settings-link-in-nav", "pass": true, "screenshot": "02-nav-close-up.png", "detail": "a[href='/admin/settings'] present inside nav[aria-label='Admin'], on desktop unhidden (not behind the hamburger) or reachable via the hamburger on mobile" },
    { "name": "footer-present", "pass": true, "screenshot": "01-full-page.png", "detail": "Footer root locator visible" },
    { "name": "toggle-still-functions", "pass": true, "screenshot": "03-toggle.png", "detail": "the existing Ozow sandbox test-mode checkbox is present and its checked state matches a fresh GET /api/admin/settings/ozow-sandbox-test-mode — proves the chrome wrap didn't break the pre-existing feature" }
  ],
  "allChecksPassed": true
}
```

`check-live-chrome.mjs` requires all SEVEN named checks present with `pass === true` in BOTH the
`desktop-*.json` and `mobile-*.json` artifacts (strict allow-list, mirroring `check-live-
purchase.mjs`'s own "not at-least-N" rule) AND each artifact's own `allChecksPassed === true`.
Screenshots are stored alongside the JSON in the same directory.

## Scope boundaries

- No visual/brand redesign — this reuses `UtilityBar`/`Header`/`Footer`/`AdminNav` exactly as
  every other admin page already does. No new colours, spacing tokens, or components.
- The existing toggle UI/logic in the current `app/admin/settings/page.tsx` (the `useState`/
  `useEffect` fetch-and-PUT flow) is unchanged in behaviour — only where it's mounted changes.
- `manage-payment-settings` already exists as a capability (`lib/admin-roles.ts`) and
  `app/admin/settings/layout.tsx` already gates on it — this feature does not touch either.

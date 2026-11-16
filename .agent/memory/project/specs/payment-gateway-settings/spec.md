# Spec: Payment gateway settings (gateway + live/sandbox)

Status: M1 DECIDED by orchestrator 2026-10-23 (see section 4); contract-f1.yaml written. M2 (Live) still BLOCKED on Brad (OQ2, OQ3). No code, no contract, no @dev dispatched.
Ticketing stays in sandbox. Nothing here switches beta to live.

Brad, verbatim: "This shouldn't just be referenced as settings because these are specific to payment gateways. It's payment gateway settings. How we, we should also be able to step in and out of sandbox mode here, not just, not just pick the payment gateway, but say payment gateway and live or payment gateway and sandbox for testing. These should only be available on admin or super admins."

Evidence limits: the files under `app/api/admin/settings/` were blocked from reading by the autonomy floor (read of protected path). What the two settings routes enforce is taken from `docs/admin-access.md:589-616` and `docs/payment-gateway-selection.md:59-74`, NOT from their source. Dev/QA must read them before relying on this. `.env.local` was not enumerated (`execution/env_keys.py` found no `.env`); env names below come from `apphosting.yaml` and the adapter source.

---

## 1. Findings

### 1.1 What "sandbox" means today: the code has NO live mode at all

Both gateways are hard-wired to sandbox. There is nothing to "step out" into.

**Ozow**
- `IsTest` is a hardcoded constant: `lib/payments/ozow.ts:86` (`OZOW_IS_TEST = 'true'`), sent on every outbound hand-off at `:298`. It is part of the signed field order (`lib/ozow.ts:46`).
- Ozow has one pay host, `OZOW_PAY_URL = https://pay.ozow.com` (`lib/ozow.ts:20`). Test vs live is the `IsTest` flag plus site code and keys, not a different host. The status-confirm call follows the notification's own `IsTest` (`lib/payments/ozow.ts:387-388`).
- Credentials read: only `OZOW_SANDBOX_SITE_CODE`, `OZOW_SANDBOX_PRIVATE_KEY`, `OZOW_SANDBOX_API_KEY` (`lib/payments/ozow.ts:105-110`, `:262-263`, `:325`, `:371-372`). `apphosting.yaml:117-129` declares exactly those three. No `OZOW_LIVE_*` exists anywhere.
- The "Ozow sandbox test mode" toggle is NOT Ozow's sandbox. It is an amount override: `OZOW_SANDBOX_TEST_AMOUNT = '0.01'` (`lib/ozow-sandbox-test-mode-shared.ts:13`), applied only when `providerId === 'ozow'` (`:45`). Read from `adminSettings/ozowSandboxTestMode` (`lib/ozow-sandbox-test-mode.ts:26-41`, fail-closed to false). Ozow is already in IsTest regardless of the toggle. The label misleads.

**PayFast**
- Sandbox hosts are constants: `PAYFAST_SANDBOX_HOST = sandbox.payfast.co.za`, process and validate URLs derived from it (`lib/payfast.ts:17-21`); the adapter posts to them unconditionally (`lib/payments/payfast.ts:235`, `:304`). ITN host list includes the sandbox host (`lib/payfast.ts:25-27`).
- Credentials read: `PAYFAST_SANDBOX_MERCHANT_ID`, `PAYFAST_SANDBOX_MERCHANT_KEY` (initiate) and `PAYFAST_SANDBOX_PASSPHRASE` (notify) (`lib/payments/payfast.ts:63-67`). `apphosting.yaml:105-114` declares them. No live PayFast names or hosts exist.

**Consequence:** "Live" is new build work plus credentials only Brad/Lee-Ann can supply (live merchant accounts, live Ozow site code/keys). It cannot be done tonight and must not be implied by the UI shipping.

### 1.2 Who can reach /admin/settings today

- Nav item `settings`, capability `manage-payment-settings` (`lib/admin-nav-config.ts:86-93`). Presentation only; hiding grants nothing (`docs/admin-access.md:585`).
- Server gate: `app/admin/(shell)/settings/layout.tsx:19-34` requires a valid admin session, then `hasCapability(token, NATIONAL_SHOW_ID, 'manage-payment-settings', {now, lookupShowWindow})`; failure redirects to `/admin`.
- The capability lives in exactly one role. `owner` is derived from every capability (`lib/admin-roles.ts:49`); `manager` is hand-listed and omits it (`:35-44`); `door-staff` omits it (`:28`). A plain `admin: true` token with no `roles` claim has zero capabilities (`docs/admin-access.md:505-506`).
- To pass: `admin === true` claim, verified email, live `ADMIN_EMAIL_ALLOWLIST` membership (`lib/admin-auth.ts:12-15`, `:50-60`), AND a `roles` claim resolving to owner either at `'*'` (org-wide) or for the show within its date window (`lib/admin-auth.ts:149-170`, `:180-205`).
- **"Super admin" does not exist** in `lib/admin-auth.ts`, `lib/admin-roles.ts` or the claims. `owner` is the closest thing. I have not invented one.
- Not verified: which real accounts hold `owner` (custom claims live in Firebase Auth, not the repo).

### 1.3 How checkout and notifications decide gateway and mode

- Gateway: `resolveActiveGateway()` reads `adminSettings/activePaymentGateway`, fail-closed to `null` (`lib/payments/active-gateway.ts:28-44`). Checkout refuses with 500 on null (`app/api/tickets/checkout/route.ts:472-479`). Never client-supplied.
- Readiness of that gateway's env keys is probed before any Firestore write (`route.ts:832-848`).
- The test-amount flag is read ONCE, before reservation (`route.ts:874`), then stamped on the order as `expectedGatewayAmount` (`:895`); `gateway` is stamped too (`:894`). **No mode field exists on an order** because there is only one mode.
- Notifications: a separate route per gateway (`app/api/tickets/itn`, `app/api/tickets/ozow-itn`); the notify URL comes from `NOTIFY_PATH_BY_PROVIDER_ID[providerId]` (`route.ts:962`). The handler verifies through the adapter it was handed, not through the active-gateway setting, then matches the amount against the stamped `expectedGatewayAmount ?? amount` (`lib/tickets-notification.ts:56-66`, `:173-190`) and rejects `order-gateway-mismatch` against the stamped `gateway` (`:283-301`).

**What survives a flip today:** switching gateway mid-flight is safe, because notification routing and the gateway check follow the order's stamped gateway. Flipping the R0.01 flag mid-flight is safe, because the order's own stamped expectation is used.

**What WOULD break once Live exists (the design must prevent):**
1. Credentials are per environment, and signature verification runs before any order lookup (`lib/payments/ozow.ts:319-339`). A sandbox-order notification arriving after a flip to Live would be checked against the live private key, fail `signature-mismatch`, and leave the order `reserved` until the reconcile job (`docs/order-reconciliation.md`). The reverse is the same.
2. A stale `IsTest=true` notification must never settle an order reserved under Live, and vice versa.
3. A leftover R0.01 flag would undercharge real money in Live (the override applies whenever the provider is `ozow`, with no mode awareness: `ozow-sandbox-test-mode-shared.ts:41-46`).
4. Two independent setting docs are written one at a time, so a reader can briefly see gateway=new, mode=old.

---

## 2. Proposed design

### 2.1 Naming
Nav label, page `<title>` and h1 become "Payment gateway settings" (Brad's words). Recommend keeping URL `/admin/settings`, nav id `settings` and icon `settings` (no route churn; Brad asked for a name, not a path). See OQ6.

### 2.2 Control: ONE combined selector (recommended)
A single radio group of four: Ozow Live, Ozow Sandbox, PayFast Live, PayFast Sandbox. Brad's phrasing, "payment gateway and live or payment gateway and sandbox", is exactly these four.
- Why not two linked controls: invalid and half-applied states exist (gateway changed, mode not yet), each a separate write. One selector writes one document atomically, and Live is a single deliberate choice rather than a toggle sitting beside a gateway change.
- Storage: one new doc `adminSettings/paymentGateway`, `{ gateway: 'ozow'|'payfast', mode: 'live'|'sandbox', updatedAt, updatedByUid, updatedByEmail }`. Replaces `activePaymentGateway` as the read source.
- Migration: a one-off script writes the new doc from today's state (`mode: 'sandbox'`), then old read paths are removed. No runtime fallback to the old docs (a fallback is a silent default). Absent or invalid new doc: checkout refuses, as today.
- Fail-closed: any unreadable, malformed or unknown value resolves to `null` (refuse), never to Live and never to a guessed default.

### 2.3 Live is a build prerequisite, not a switch (keeps beta in sandbox)
- Add per-mode credential sets (proposed names, to confirm: `OZOW_LIVE_SITE_CODE`, `OZOW_LIVE_PRIVATE_KEY`, `OZOW_LIVE_API_KEY`, `PAYFAST_LIVE_MERCHANT_ID`, `PAYFAST_LIVE_MERCHANT_KEY`, `PAYFAST_LIVE_PASSPHRASE`). Adapters take `mode`; Ozow sends `IsTest` true/false from mode instead of the constant; PayFast picks sandbox vs live host from mode. Readiness is evaluated per gateway AND mode.
- Second lock, independent of the Firestore doc: a server env flag (proposed `PAYMENTS_LIVE_ENABLED`) that is absent from the beta backend. While absent, the server rejects any PUT choosing a Live option AND checkout refuses a stored Live value. A hand-edited Firestore doc or a compromised owner session cannot take beta live. Go-live sets that flag in production config, a deliberate act by Brad.
- Live radios render disabled with the reason until readiness for that gateway+mode is true server-side.
- After this work lands, the deployed beta state is still Sandbox, unchanged from today.

### 2.4 Guardrails for switching to Live
All server-enforced; the UI only mirrors them.
1. Capability re-checked in the PUT handler on every call (`manage-payment-settings`), independent of the page gate.
2. Reject if `PAYMENTS_LIVE_ENABLED` is unset, or if readiness for that gateway+mode is false (HTTP 409 naming missing key NAMES only, never values).
3. Explicit confirmation step before any change TO Live (Live to Sandbox needs none). Copy gap, see 2.8.
4. Audit log, append-only, written in the SAME Firestore transaction as the setting: collection `adminSettingsAudit`, doc `{ setting: 'paymentGateway', from: {gateway,mode}, to: {gateway,mode}, byUid, byEmail, at (server timestamp), requestId }`. Admin SDK only, never updated or deleted by code. Written for every change including Live to Sandbox. A failed audit write fails the change.
5. Visible banner while the effective mode is Sandbox: persistent strip in the admin shell (`components/admin/shell/AdminShell.tsx`), on every admin page, using existing admin tokens. Public-site banner: see OQ4.
6. Reject no-op writes (`to` equals current); rate-limit the route.
7. The banner also fails closed: unknown mode renders as an error state, never as "Live" or "Sandbox".

### 2.5 The existing R0.01 test mode: folded in
- Becomes a nested option under Ozow Sandbox only: `ozowTestAmount: boolean` inside `adminSettings/paymentGateway`, forced `false` whenever mode is `live` or gateway is not `ozow`. One document, so the two cannot disagree.
- Server hard rule: `resolveExpectedGatewayAmount` and `resolveOzowInitiateAmount` receive mode and ignore the override in Live (closes breakage 3). Needs a regression check that Live never yields R0.01.
- The old `adminSettings/ozowSandboxTestMode` doc and `/api/admin/settings/ozow-sandbox-test-mode` route are retired after migration. See OQ5.
- Label problem: today's "Ozow sandbox test mode" is really "R0.01 amount"; real sandbox is the mode choice. Copy gap.

### 2.6 Access
- Recommendation: no new role. "Super admin" maps to the existing `owner` role (sole holder of `manage-payment-settings`, `lib/admin-roles.ts:49`). A new role is an invention (`docs/rules/no-invention.md`), and a plain admin already has zero capabilities. See OQ1.
- Nav: unchanged mechanism, item visible only with `canManagePaymentSettings` (`lib/admin-nav-config.ts:106`).
- Page: existing server gate `settings/layout.tsx:26-34` stays.
- APIs: GET and PUT both re-check `admin` + verified + allowlist + capability via `lib/admin-auth.ts`, never trusting the nav. GET is gated too (mode is operationally sensitive). QA must prove a manager token and a plain-admin token get 403 on both verbs by calling the routes directly.
- Wrinkle: the layout resolves capability at `NATIONAL_SHOW_ID` within the show window; a per-show owner grant is honoured only inside its window (`lib/admin-auth.ts:149-170`). An org-wide `'*'` owner always passes. Settings authority should not expire with a show window; recommend the new routes check at org scope (`'*'`). Flag if per-show owners exist.

### 2.7 Order and notification handling across a mode switch
- Stamp `gatewayMode: 'live'|'sandbox'` on every order at reservation, in the same transaction as `gateway` (`route.ts:894` area), from the single resolved setting read ONCE per checkout, like the existing flag read (`route.ts:867-874`). Orders without the field (all pre-change orders) are treated as `sandbox`, since nothing has ever run live.
- Notification verification uses the credentials of the ORDER's stamped mode, never the current setting. Signature check precedes order lookup today, so the flow becomes: read the reference from the raw body (untrusted, used only to select which key set to try), load the order's stamped mode, verify the signature with that mode's key, fail closed if the order is missing. A forged reference can only select a key; it must still carry a valid signature for it.
- Cross-mode guard: reject (log, leave order untouched) when the notification's test marker (Ozow `IsTest`; PayFast sandbox validate result) disagrees with the stamped mode.
- Result: orders reserved under Sandbox settle under Sandbox credentials after a flip to Live (and the reverse); nothing crosses; in-flight sandbox orders stay payable.
- Reconcile job records mode in its alert so a stranded order is attributable.
- Docs to update at the docs step: `docs/payment-gateway-selection.md`, `docs/admin-access.md` Admin Settings section, CLAUDE.md Payments and `adminSettings` rows.

### 2.8 Copy (no-invention)
Allowed, from Brad's words: "Payment gateway settings"; "payment gateway"; "live"; "sandbox"; option labels "Ozow Live / Ozow Sandbox / PayFast Live / PayFast Sandbox" (his "payment gateway and live" / "and sandbox" with gateway names already in the repo).

Reusable existing strings (`app/admin/(shell)/settings/page.tsx`):
- "Active payment gateway" (`:130`)
- "Customers no longer choose a gateway at checkout — this is used for every purchase." (`:132`)
- "No gateway is set — checkout will refuse purchases until one is chosen." (`:151`)
- "Failed to save. Please try again." (`:59`)
- "Failed to load current setting." (`:35`)

**COPY GAPS (named, not filled):** (a) the Live confirmation dialog title, body, button labels; (b) the Sandbox banner text; (c) the reason shown on a disabled Live option; (d) the R0.01 option label and helper (existing helper `page.tsx:122` says "PayFast is unaffected", still true but needs Brad's wording); (e) the 409 messages for "live not enabled" and "not configured"; (f) an audit-log view, if Brad wants one in admin.

### 2.9 Visuals
Existing admin components only: `PageShell`/`PageHeader` (`components/admin/PageHeader.tsx`), `CARD_CLASS` and tokens (`components/admin/tokens.ts`), `AdminPill`/`StatusPill` for a mode marker, the `ErrorText` pattern (`page.tsx:161-168`), `DetailDrawer`/`useFocusTrap` if a modal is used for confirmation. Banner follows the shell and `design/design_handoff_saoc/colors_and_type.css` tokens. No new colours, fonts or components. The UI brief must name impeccable, frontend-design, web-design-guidelines and accessibility.

---

## 3. Risks
- Live code paths cannot be exercised without live credentials; correctness of Live adapters (Ozow `IsTest=false` hash, PayFast live host) is unproven until a supervised go-live test. Mitigated by the double lock (2.3) and shipping Live disabled.
- Verification-by-stamped-mode (2.7) changes a payment security boundary: needs Codex review and adversarial tests for key-selection abuse.
- Retiring two docs and a route needs a clean migration; a half-migrated state refuses checkout (fail-closed, but visible to buyers on beta).
- The `NATIONAL_SHOW_ID`-scoped check could lock out a show-scoped owner outside the show window (2.6).
- Unread: the current settings route source (floor-blocked). Dev must read it before changing it.

## 4. OPEN QUESTIONS FOR BRAD

### DECISIONS RECORDED 2026-10-23 (orchestrator, M1; contract-f1.yaml)

| OQ | status | decision |
|---|---|---|
| OQ1 | DECIDED by orchestrator | "super admin" = existing `owner` role, owner only, no new role. `manager` does not reach payment settings |
| OQ2 | **OPEN for Brad** | second approver for Live; M2 |
| OQ3 | **OPEN for Brad** | live credentials, env names, whether PayFast goes live; M2 |
| OQ4 | DECIDED by orchestrator | sandbox banner admin-only, inside Payment settings (public site already has the committee testing banner, PR #60) |
| OQ5 | DECIDED by orchestrator | R0.01 override folded in as an Ozow-Sandbox-only sub-option, labelled honestly as an amount override, not Ozow's sandbox |
| OQ6 | DECIDED by orchestrator | new nav group PAYMENTS, item "Payment settings", `/admin/payments`; `/admin/settings` becomes general Settings (F2). API stays under `/api/admin/settings/...` (checkout/status readers and legacy checks key on it; no user value in renaming) |
| OQ7 | DECIDED by orchestrator | owners today: brad@inunu.net and 2027national@gmail.com, both `{"*":["owner"]}` (claims not verifiable from repo) |
| OQ8 | DECIDED by orchestrator | Firestore audit (`adminSettingsAudit`: who, when, before, after) plus a "Recent changes" list on the page |
| OQ9 | DECIDED by orchestrator | deferred to M2; M1 uses a plain `window.confirm` on gateway switch |

M1 scope deltas from sections 2.2-2.7: Sandbox is the only selectable mode, Live renders disabled with a credentials explanation; NO stored mode, NO combined `paymentGateway` doc, NO migration, NO `PAYMENTS_LIVE_ENABLED`, NO `gatewayMode` order stamp, NO adapter or notification changes. Existing docs `adminSettings/activePaymentGateway` and `adminSettings/ozowSandboxTestMode` stay the stores. Sections 2.2-2.4 (combined selector, live lock) and 2.7 (stamped-mode verification) are M2 design, unchanged, not built in M1.
Update 2026-10-23: the two settings routes WERE readable in the architect session (earlier floor block no longer applies); contract goldens cite their source.

- **OQ1. What is "super admin"?** (a) the existing `owner` role, no new code (recommended); (b) a new role above owner. And does "admin" in "admin or super admins" mean Lee-Ann's `manager` role should ALSO reach this page? Today it cannot (`lib/admin-roles.ts:35-44`). Recommendation: owner only.
- **OQ2. Second admin for Live?** Should switching to Live need a second owner to approve, or are one owner plus confirmation, audit entry and the env lock enough? Recommendation: one owner plus the env lock.
- **OQ3. Live credentials.** Who holds Ozow live and PayFast live credentials, and are the proposed env names acceptable? Is PayFast to be a Live option at all, or only Ozow (CLAUDE.md: Ozow active, PayFast retained)?
- **OQ4. Sandbox banner scope.** Admin-only (recommended), or also on the public site and checkout while sandbox? A public banner would show on beta permanently and needs his wording.
- **OQ5. R0.01 test mode.** Fold in as an Ozow-Sandbox-only sub-option (recommended), keep separate, or drop it now that the real mode choice exists?
- **OQ6. URL and route names.** Keep `/admin/settings` and `/api/admin/settings/...` (recommended) or rename to a payment-gateway path?
- **OQ7. Who holds `owner` today?** Custom claims are not visible from the repo. Confirm the intended people so the page is neither unreachable nor too open.
- **OQ8. Audit visibility.** Firestore-only log, or viewable in admin and/or emailed to admin recipients on every change?
- **OQ9. Confirmation style.** Plain confirm dialog or type-to-confirm (copy needed either way).

## 5. Out of scope
Any live go-live; setting `PAYMENTS_LIVE_ENABLED` anywhere; vendor stand payments (they share the gateways via `lib/vendor-stand-payment-notification.ts` and need the same stamped-mode treatment as a follow-up, flagged not designed); new brand assets.

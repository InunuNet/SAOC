# Research: payment-gateway-settings M1-F1/F2 (architect, 2026-10-23)

## Read (source, not docs)
- `app/api/admin/settings/active-payment-gateway/route.ts`, `.../ozow-sandbox-test-mode/route.ts`: readable now. Both: `checkGate()` = `getAdminSession()` (401 no/invalid session, else 403) then `hasCapability(..., NATIONAL_SHOW_ID, 'manage-payment-settings', {now, lookupShowWindow})` -> 403. PUT writes `adminSettings/<doc>` with `.set({..., updatedAt: serverTimestamp, updatedByEmail})`. No uid, no before-value, no audit. PUT calls `getAdminSession()` a second time to get the email.
- `app/admin/(shell)/settings/{layout,page}.tsx`: layout gates on the capability and redirects to `/admin`; page is a `'use client'` component fetching both routes; holds the misleading "Ozow sandbox test mode" label (R0.01 override).
- `lib/admin-nav-config.ts`: Settings item carries capability `manage-payment-settings`; `visibleNavGroups` drops empty groups. `app/admin/(shell)/layout.tsx` resolves the two capability booleans for presentation only.
- `lib/admin-roles.ts`: `owner` derived from all capabilities; `manager` hand-listed without `manage-payment-settings`.
- `lib/payments/active-gateway.ts`: store shape and fail-closed read.
- `components/admin/useAdminSignOut.ts`, `docs/admin-access.md:572-583`: sign-out already calls `revokeRefreshTokens`, so it is sign-out-everywhere; no separate action exists.
- `lib/ticketing-test-mode.ts`: `TICKETING_PAYMENTS_LIVE = false` (standing rule), asserted unchanged.
- Dashboard link `components/admin/dashboard/DashboardParts.tsx:163` and fixtures `app/admin-fixtures/[route]/page.tsx:17,43,95` point at the old settings page; both need updating.

## Not found / not sourced
- Per-admin dashboard preferences: none anywhere (searched `lib/admin-dashboard.ts`, admin components, docs). F2 ships Profile only.
- Which accounts really hold `owner`: Firebase custom claims, not in repo. Taken from the orchestrator.
- Whether `decodedToken.firebase.sign_in_provider` is populated on session-cookie-verified tokens in this deployment was not run live; `verifySessionCookie` returns a `DecodedIdToken` that includes `firebase.sign_in_provider`. @dev: if absent, show "Unknown", do not guess.
- No `.env` enumerated; nothing here needs a secret.

## Baseline
Of `contracts/checks/ozow-sandbox-toggle-f1/*` 3 fail on main before this work (`check-checkout-route-wiring`, `check-fail-closed-flag-read`, `check-notification-amount-match-test-mode`) plus `contracts/checks/vendor-stand-sandbox-amount/check-static-wiring.mjs`. The other nine pass and A14 holds them.

## Tradeoffs
- Keep existing two docs vs new combined doc: M1 has one mode, so a combined doc buys nothing and forces a checkout migration with fail-closed buyer impact on beta. Rejected for M1; M2 design stands.
- Audit in the same transaction vs best-effort log: transaction, because an unaudited payment change is the exact thing Brad asked to prevent; cost is a failed audit write blocks the change (acceptable, rare, visible).
- API under `/api/admin/settings` vs `/api/admin/payments`: keep. Rename touches 3 readers and legacy checks for no visible gain.
- No-op writes: no audit row, so Recent changes stays signal.
- Nav icon: reuse `tickets` rather than draw a new asset (design rule).

## Risks
1. admin-redesign mission in flight edits the same nav/shell/dashboard files and its `auth-gate.sh`/`render-check.mjs` encode the old settings topology. Sequence or supersede with lead's say-so.
2. Capability check is window-limited at `NATIONAL_SHOW_ID`; fine for current `'*'` owners, would lock out a show-scoped owner outside the show window.
3. Audit rows are readable only through the owner-gated page; no email notice (OQ8 chose Firestore plus list).
4. The R0.01 option label is Brad-copy territory; PROPOSED text may be rewritten.

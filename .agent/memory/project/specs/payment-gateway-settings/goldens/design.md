# Golden: payment-gateway-settings M1-F1 (Payment settings page) design

Authority: Brad (verbatim in spec.md) + orchestrator decisions on OQ1,4,5,6,7,8,9. Sandbox is the ONLY selectable mode.
No live code path, no live env names, no stored mode. Anything not listed here is not in scope.

## 1. Files (exact paths; contract assertions look for these)
| path | kind | role |
|---|---|---|
| `lib/payment-mode.ts` | new, client-safe (no firebase-admin) | mode constants and parser |
| `lib/payment-settings-audit.ts` | new, server-only | audited write + recent-changes read |
| `app/admin/(shell)/payments/layout.tsx` | new | server gate (copy of settings/layout.tsx as it is today) |
| `app/admin/(shell)/payments/page.tsx` | new, SERVER component | reads gateway, R0.01 flag, recent audit; passes plain data to the panel |
| `app/admin/(shell)/payments/loading.tsx`, `error.tsx` | new | copy the settings siblings |
| `components/admin/PaymentSettingsPanel.tsx` | new, `'use client'` | gateway radios, mode control, R0.01 option, banner, recent changes; calls the existing PUT routes; `router.refresh()` after a successful save |
| `app/api/admin/settings/active-payment-gateway/route.ts` | edit | PUT uses audited write; accepts optional `mode` |
| `app/api/admin/settings/ozow-sandbox-test-mode/route.ts` | edit | PUT uses audited write |
| `lib/admin-nav-config.ts` | edit | new PAYMENTS group, general Settings item |
| `components/admin/dashboard/DashboardParts.tsx` | edit | "Payment settings" link -> `/admin/payments` |
| `app/admin-fixtures/[route]/page.tsx` | edit | add a `payments` fixture entry; keep `settings` entry (now the F2 page) |

API routes STAY under `/api/admin/settings/...`. Justification: three public/checkout readers and the existing contract checks key on those URLs; the URL is an internal detail Brad never sees; renaming is churn with regression risk and no user value. The page moves, the API does not.

## 2. `lib/payment-mode.ts`
```
PAYMENT_MODES            = ['sandbox', 'live'] as const
SELECTABLE_PAYMENT_MODES = ['sandbox'] as const        // M2 adds 'live' here, behind Brad's decisions
type PaymentMode         = (typeof PAYMENT_MODES)[number]
parsePaymentMode(value: unknown):
  | { ok: true; mode: 'sandbox' }
  | { ok: false; reason: 'live-not-available' | 'invalid-mode' }
```
Rules: `undefined` -> ok/sandbox (callers that send no mode keep working). Exactly the string `'sandbox'` -> ok. Exactly `'live'` -> `live-not-available`. Everything else (wrong case, whitespace, null, number, object, empty string) -> `invalid-mode`. It never returns `live` as ok. No env reads, no Firestore.

## 3. `lib/payment-settings-audit.ts`
```
PAYMENT_AUDIT_COLLECTION = 'adminSettingsAudit'
type PaymentSettingId = 'activePaymentGateway' | 'ozowSandboxTestMode'
writeAuditedSettingChange(
  db: Pick<Firestore, 'collection' | 'runTransaction'>,
  args: { setting: PaymentSettingId; next: Record<string, string | boolean>; actor: { uid: string; email: string | null } },
): Promise<{ changed: boolean; from: Record<string, unknown>; to: Record<string, unknown> }>
listRecentPaymentSettingsChanges(db, limit = 10): Promise<PaymentSettingsChange[]>   // newest first, plain Dates, no Timestamp instances
```
`writeAuditedSettingChange`:
1. Refuses (throws) any `setting` not in the two-value union (runtime check, not only the type).
2. ONE `db.runTransaction`. Inside: `tx.get(adminSettings/<setting>)`, compute `from` = for each key of `next`, the stored value or `null` (never `undefined`; a missing doc gives all-null). `to` = `next`.
3. If every key of `from` equals `next`: return `{changed:false}` and write NOTHING (no audit entry for a no-op).
4. Else `tx.set` the setting doc `{...next, updatedAt: FieldValue.serverTimestamp(), updatedByEmail: actor.email}` AND `tx.set` a new auto-id doc in `adminSettingsAudit`:
   `{ setting, from, to, mode: 'sandbox', byUid, byEmail, at: FieldValue.serverTimestamp() }`.
5. Both sets are in the same transaction, so a failed audit write fails the change (fail closed). No `undefined` own-properties anywhere (docs/firestore-undefined-write-safety.md).
`adminSettingsAudit` is Admin-SDK-only, append-only: no code path updates or deletes it. `mode` is the constant `'sandbox'` because M1 has no other mode; it exists so M2 rows are attributable.
`listRecentPaymentSettingsChanges` orders by `at` desc, `limit`, converts Timestamps to `Date` by duck-typed `.toDate()` (same approach as `lib/firestore-serialization.ts`). Needs a single-field index only (auto); no composite index.

## 4. Routes
Both routes: `checkGate()` unchanged (session first, then `manage-payment-settings`). It runs BEFORE any read, JSON parse or write, in GET and PUT.
- Actor: `session.decodedToken.uid` and `.email` from the one verified `getAdminSession()` result. Do not call `getAdminSession()` a second time inside the PUT (today's code does; fold it into `checkGate`'s return).
- `active-payment-gateway` PUT body: `{ gateway: 'ozow'|'payfast', mode?: 'sandbox' }`. After the existing gateway validation, `parsePaymentMode(body.mode)`; on `ok:false` return 400 `{ error, reason }` (`live-not-available` or `invalid-mode`) and write nothing. Response 200 `{ gateway, mode: 'sandbox', changed }`. GET returns `{ gateway, mode: 'sandbox' }`.
- `ozow-sandbox-test-mode` PUT: body unchanged `{ enabled: boolean }`; audited write with `next: { enabled }`.
- Neither route may contain the literal `'live'` (only `lib/payment-mode.ts` and the panel do).
- 500 path logs operation + error name only; never the body or tokens.
- Not touched: checkout, notifications, adapters, `lib/payments/*`, `lib/ozow*`, `lib/payfast.ts`, `apphosting.yaml`, the `adminSettings/*` doc shapes, `resolveActiveGateway`, `isOzowSandboxTestModeEnabled`. No migration, no new Firestore index.

## 5. Page and gate
`payments/layout.tsx`: exactly today's `settings/layout.tsx` body (session -> `/admin/login`; `hasCapability(token, NATIONAL_SHOW_ID, 'manage-payment-settings', {now, lookupShowWindow})` -> else `/admin`; `dynamic = 'force-dynamic'`). Access = `owner` only; both current owners hold `{"*":["owner"]}` so the show-window wrinkle (spec 2.6) does not bite. Do not add a role. Org-scope-only checking is a possible M2 hardening, noted not built.
`payments/page.tsx` (server): `resolveActiveGateway()`, `isOzowSandboxTestModeEnabled()`, `listRecentPaymentSettingsChanges(db)`; render `<PaymentSettingsPanel initialGateway initialTestAmount recent />`. A failed audit read renders the panel with an inline "Recent changes could not be loaded." and does not break the page.

## 6. Panel (see page-states.md for copy and the state matrix)
- Visuals: `PageShell`/`PageHeader`, `CARD_CLASS`, `AdminPill`/`StatusPill` for a Sandbox marker, `ErrorText` pattern from the current settings page. No new colours, fonts, components, icons. Impeccable, frontend-design, web-design-guidelines and accessibility skills apply (44px targets, never colour alone, `role="alert"` on errors).
- Gateway: radios Ozow / PayFast (existing). Change -> `window.confirm(...)` -> PUT. Cancel leaves everything untouched. Failure rolls back the optimistic value (existing pattern).
- Mode: a radio group "Sandbox" (selected, enabled) and "Live" (disabled, with the explanation visible as text, not a tooltip). Derived from `PAYMENT_MODES` / `SELECTABLE_PAYMENT_MODES`; a mode is disabled iff not in `SELECTABLE_PAYMENT_MODES`. The panel never sends `mode: 'live'`.
- R0.01 option: checkbox, enabled only when gateway is Ozow (mode is always Sandbox in M1); disabled with a reason otherwise.
- Banner (admin-only, inside this page): persistent strip while mode is Sandbox.
- Recent changes: last 10, newest first: time (SAST via `lib/sast-date.ts`), who (email), what (before -> after). Empty state text.

## 7. Nav (`lib/admin-nav-config.ts`)
New group `{ id: 'payments', label: 'PAYMENTS', items: [{ id: 'payment-settings', label: 'Payment settings', href: '/admin/payments', icon: 'tickets', available: true, capability: 'manage-payment-settings' }] }`, placed before SYSTEM. Icon: reuse the existing `tickets` glyph (no new asset); flagged as a question for Brad. SYSTEM group's `Settings` item keeps href `/admin/settings`, loses its `capability` (visible to every admin). `isItemVisible` and the shell props are unchanged. `/admin/settings` is general Settings (F2); there is no redirect in the final state because F2 ships in the same contract (if @dev lands F1 before F2 in separate commits, the interim `/admin/settings` is a permanent redirect to `/admin/payments`, removed by F2).

## 8. "Nothing in M1 can produce a live charge" -- why it holds, and the assertion that proves it
1. The only new inputs are a `mode` that is rejected unless `'sandbox'` and a constant.
2. No stored mode is read by checkout, notifications or adapters.
3. `OZOW_IS_TEST = 'true'` (`lib/payments/ozow.ts:86`) and PayFast sandbox host constants are untouched; no `OZOW_LIVE_*`, `PAYFAST_LIVE_*` or `PAYMENTS_LIVE_ENABLED` exists anywhere, including `apphosting.yaml`.
4. `TICKETING_PAYMENTS_LIVE = false` (`lib/ticketing-test-mode.ts`) stays false.
A13 (static.sh no-live) greps all of this; A9/A10 prove a `live` request is rejected.

## 9. Known cross-mission conflicts (lead must sequence)
`contracts/checks/admin-redesign/auth-gate.sh` (line 13: settings layout must contain `manage-payment-settings`; line 30: `app/api/admin/settings` must be unchanged) and `render-check.mjs` (`settings` active `/admin/settings`) encode the old topology. They will fail once this lands; the admin-redesign mission is in flight and also edits `lib/admin-nav-config.ts`, the shell and `DashboardParts.tsx`. Land after admin-redesign, or supersede those two checks as part of this work with the lead's say-so. @dev must not edit them silently.
Four legacy checks already FAIL on main before this work (`check-checkout-route-wiring`, `check-fail-closed-flag-read`, `check-notification-amount-match-test-mode`, `vendor-stand-sandbox-amount/check-static-wiring`); out of scope, listed so they are not blamed on this change. A14 runs only the nine that pass today.

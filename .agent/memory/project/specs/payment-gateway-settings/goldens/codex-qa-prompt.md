# QA inputs for M1-F1 (from @architect, not @dev). Run via execution/codex_qa.sh against @dev's diff.

Probe, by calling the routes directly (not via the UI):
1. `PUT /api/admin/settings/active-payment-gateway` with `{gateway:'ozow', mode:'live'}`, `mode:'LIVE'`, `mode:null`, `mode:1`, `mode:{}` -> all 400, no Firestore write, no audit doc.
2. GET and PUT on both routes with: no cookie (401), a plain `admin:true` token with no roles (403), a `manager` token (403), an owner token (200). Confirm the 403 happens before any Firestore read (spy on `getFirestore`).
3. A real change writes exactly one `adminSettingsAudit` doc with correct from/to/byUid/byEmail/mode; a no-op PUT writes none; a forced audit-write failure leaves the setting unchanged and returns 500.
4. Grep the whole diff for `live` in routes, `IsTest`, any new env name, any change under `lib/payments/`, `lib/ozow*.ts`, `lib/payfast.ts`, `apphosting.yaml`. Expect none.
5. Panel: Live is disabled, cannot be activated by keyboard or by editing the DOM into a request the server accepts; R0.01 disabled on PayFast; confirm Cancel sends no request.
6. `/admin/payments` as manager and plain admin redirects to `/admin`; `/admin/settings` renders for both and shows no payment controls and no `manage-payment-settings` reference; nav shows Payment settings only for owner.
7. Settings page profile values come from the verified token only; a token with a `roles` claim of unexpected shape (string, array) renders "No roles assigned" without throwing.
8. Adversarial on audit: concurrent PUTs both succeed with consistent from/to chain (transaction), no `undefined` fields written.

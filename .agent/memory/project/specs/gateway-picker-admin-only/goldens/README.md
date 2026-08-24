# gateway-picker-admin-only F1 — golden index

The full decision record and per-file golden shapes for this feature live under
`contracts/golden/gateway-picker-admin-only-f1/`, not here (this project's established location
for golden files that pair with contract assertions — see `venue-never-changed-copy-fix-f1` for
the same convention):

- `contracts/golden/gateway-picker-admin-only-f1/README.md` — decision record
- `contracts/golden/gateway-picker-admin-only-f1/active-gateway-lib.golden.md` — `lib/payments/active-gateway.ts`
- `contracts/golden/gateway-picker-admin-only-f1/admin-route.golden.md` — `app/api/admin/settings/active-payment-gateway/route.ts`
- `contracts/golden/gateway-picker-admin-only-f1/checkout-route-diff.golden.md` — `app/api/tickets/checkout/route.ts` diff
- `contracts/golden/gateway-picker-admin-only-f1/checkout-ui-diff.golden.md` — checkout UI diff
- `contracts/golden/gateway-picker-admin-only-f1/admin-settings-ui.golden.md` — `app/admin/settings/page.tsx` addition

Check scripts for the automated assertions live under
`contracts/checks/gateway-picker-admin-only-f1/`.

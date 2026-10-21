# Expected CLAUDE.md regions after the claude-md-ozow edit

Wording constraints only; Dev chooses exact phrasing but every bullet must hold.
No facts beyond those listed may be introduced.

## 1. Tech Stack table, Payments row (was line 24)

Was: `| Payments | PayFast (sandbox) | Ticket checkout + ITN webhook verification (`lib/payfast.ts`) |`

Must:
- stay a single table row starting `| Payments |`
- name Ozow (test mode) as the active gateway, chosen by Lee-Ann, set in /admin/settings
- say the PayFast integration is retained but never used for testing
- the why column references `lib/ozow.ts`, `lib/payments/` and `docs/payment-gateway-selection.md`
- no longer contain the string `PayFast (sandbox)`

Illustrative shape:
`| Payments | Ozow (test mode) — active gateway, chosen by Lee-Ann, set in /admin/settings. PayFast integration retained, never used for testing | Ticket checkout + payment-notification webhooks (`lib/ozow.ts`, `lib/payments/`); see `docs/payment-gateway-selection.md` |`

## 2. Project Structure tree, tickets/ line (was line 55)

Was: `│   ├── tickets/            # PayFast checkout + ITN webhook → Firestore `tickets``

Must: mention Ozow checkout (active gateway) plus payment-notification webhooks into Firestore `tickets`.

Illustrative: `│   ├── tickets/            # Ozow checkout (active gateway) + payment-notification webhooks → Firestore `tickets``

## 3. Project Structure tree, lib/ block (was line 72)

Was: `├── payfast.ts               # PayFast signature + sandbox constants`

Must:
- add one line `├── ozow.ts ... # Ozow signature/hash + sandbox handling`
- annotate payfast.ts line as retained, not the active gateway

Illustrative:
```
├── ozow.ts                  # Ozow signature/hash + sandbox handling (active gateway)
├── payfast.ts               # PayFast signature + sandbox constants (retained, not the active gateway)
```

## Unchanged

The `vendorStandOrders` row (line 112, "PayFast/Ozow ITN handler") is byte-identical to HEAD.

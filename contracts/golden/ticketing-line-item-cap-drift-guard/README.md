# Line-item cap drift guard — decision record

Mission `multi-line-item-cart`, follow-up fix. `lib/cart.ts` currently declares its own local
`CART_MAX_LINE_ITEMS = 20`, independently of `app/api/tickets/checkout/route.ts`'s
`MAX_LINE_ITEMS = 20`. Both are 20 today by coincidence, not by construction — nothing keeps them
equal. This contract specifies extracting the constant into one client-safe module both files
import, and an assertion that fails the moment the two values (or their sourcing) ever diverge.

---

## Why `lib/cart.ts` has its own local constant in the first place

Found by @dev, correctly, while implementing the cart UI: `app/api/tickets/checkout/route.ts`
imports `firebase-admin/firestore` and the Sanity client at module scope. A client component
(`lib/cart.ts` is imported by `components/tickets/useTicketCart.ts`, a `'use client'` hook) cannot
import a VALUE from that route module — Turbopack cannot chunk `node:dns`/`node:fs`/`node:net`
into a browser bundle, confirmed by @dev via `pnpm build` ("the chunking context does not support
external modules"). A **type-only** import from the route would have been fine (types erase at
build time and never reach the bundle), but `MAX_LINE_ITEMS` is a **value**, not a type — the
distinction that broke this. @dev was correctly fenced out of `app/api/` and could not fix the
root cause from `lib/cart.ts` alone, so it defined a local, explicitly-documented duplicate and
flagged it rather than silently working around it. That was the right call under the fence; it is
now a real, if currently-latent, drift risk that needs closing.

---

## The fix

**Single source of truth: `lib/tickets-constants.ts`.** Already the project's established
client-safe constants module — no `firebase-admin`/Sanity import, already imported by both
`app/(marketing)/tickets/page.tsx` (server) and `components/tickets/TicketPurchaseForm.tsx`
(`'use client'`) today for `NATIONAL_SHOW_ID`, so its client-bundle-safety is an already-proven
fact, not a new claim this contract introduces.

```ts
// lib/tickets-constants.ts — ADDITIVE
/** Resource-exhaustion ceiling on the number of distinct line items a single checkout
 *  request may carry — NOT the council's 5-tickets-per-booking business rule (that is
 *  mission F6/Stage 4's job, unrelated). Moved here, out of
 *  app/api/tickets/checkout/route.ts, so both the server (which enforces it) and any
 *  client code (which pre-checks it for UX only) import the SAME symbol — see
 *  contracts/golden/ticketing-line-item-cap-drift-guard/README.md. */
export const MAX_LINE_ITEMS = 20;
```

```ts
// app/api/tickets/checkout/route.ts — the local `export const MAX_LINE_ITEMS = 20;`
// declaration is REMOVED and replaced with:
import { MAX_LINE_ITEMS } from '@/lib/tickets-constants';
// parseLineItems()'s existing use of MAX_LINE_ITEMS is otherwise UNCHANGED — same
// comparison, same position, same behaviour, now reading the shared symbol.
```

```ts
// lib/cart.ts — the local `export const CART_MAX_LINE_ITEMS = 20;` declaration's
// LITERAL is removed; the EXPORTED NAME is kept (so components/tickets/useTicketCart.ts
// needs no change) but now re-exports the shared value:
import { MAX_LINE_ITEMS } from '@/lib/tickets-constants';
export const CART_MAX_LINE_ITEMS = MAX_LINE_ITEMS;
```

Why keep the `CART_MAX_LINE_ITEMS` export name in `lib/cart.ts` rather than having
`useTicketCart.ts` import `MAX_LINE_ITEMS` directly from `lib/tickets-constants.ts`: either would
work; re-exporting keeps the change confined to `lib/cart.ts` + `lib/tickets-constants.ts` +
`app/api/tickets/checkout/route.ts` (the files this contract's own fence allows @dev to touch
under the orchestrator's routing) without touching `components/tickets/useTicketCart.ts`, which is
UI implementation the cart-UI contract already specified and shipped — smaller diff, same fix.
Either naming is acceptable if the orchestrator's @dev prefers the direct-import form instead; the
assertion below is agnostic to which of the two shapes is chosen, since it only requires
`lib/cart.ts`'s exported cap constant (whatever it is named) to import, not redeclare, the shared
symbol from `lib/tickets-constants.ts`.

---

## The two traps named by the team lead, and how the assertion is designed around each

1. **"A check that merely greps for the literal `20` in both files would pass even after someone
   changes one of them to a different literal."** The check never looks for the literal `20`
   anywhere in its own source. It reads the ACTUAL RUNTIME VALUES of the imported symbols (case A)
   and, independently, parses each file with the TypeScript compiler API (never a text grep) to
   prove the consuming files IMPORT the symbol rather than declaring their own literal (case B). A
   divergent literal in either file fails case B regardless of what number it happens to be —
   the check would catch `MAX_LINE_ITEMS = 25` in one file just as readily as `= 20`.
2. **"Would also pass if both imports were deleted."** Case B's import-presence check fails
   outright, by file and by reason, the moment either consumer's import of the shared symbol is
   missing — REGARDLESS of whether the two exported values still happen to be numerically equal.
   Case A alone could still pass by coincidence (two independent literals, still both 20); case B
   cannot, because it does not look at values at all, only at how each file obtains its value.

**Case C** is a self-referential behavioural boundary test: `parseLineItems()` must accept exactly
`MAX_LINE_ITEMS` line items and reject `MAX_LINE_ITEMS + 1` — using WHATEVER value the shared
module currently exports, never a hardcoded `20` anywhere in the check itself. This proves the
route's actual validation logic is wired to the shared constant's LIVE value (if the constant is
ever changed to e.g. `10`, this case's boundary moves with it and still passes), not merely that
some unrelated exported number happens to match today.

## Detector self-test — proven before judging the real files

Following this project's own established convention
(`contracts/checks/ticketing-hardening/check-checkin-route-delegates.mjs`), the check's two AST
helper functions (`importsCapFromTicketsConstants`, `hasLocalNumericLiteralCap`) are run against
four synthetic, inline fixtures BEFORE either is trusted to judge the real files:

- a genuinely compliant consumer (import only, no local literal) — both detectors must agree it's
  clean;
- a non-compliant consumer with ONLY a local literal (no import at all) — must be caught;
- a consumer with an unrelated, differently-named local constant (`CAP`, not `MAX_LINE_ITEMS`-
  shaped) — must NOT be falsely flagged, proving the pattern is specific rather than "any numeric
  literal anywhere";
- **the partial-fix fixture**: a real import PLUS a leftover local literal declaration (the
  realistic failure mode — someone adds the import but forgets to delete the old constant) — MUST
  trip BOTH detectors, proving a half-finished fix is still caught, not waved through because an
  import is now technically present.

All four self-test cases pass against the detector logic as written (verified below) — the
detector genuinely discriminates before it is ever pointed at the real tree.

---

## What this contract does NOT touch

`app/api/` implementation belongs to the @dev session the orchestrator routes it to — this
contract specifies the fix precisely enough to implement without design decisions left open, but
does not implement it. `components/tickets/useTicketCart.ts` needs no change under the
re-export design above (see "Why keep the `CART_MAX_LINE_ITEMS` export name" section).

---

## Assertion inventory

| ID | Proves | Kind | Negative control |
|----|--------|------|-------------------|
| A1 | `MAX_LINE_ITEMS` is single-sourced from `lib/tickets-constants.ts`; both `lib/cart.ts` and the route import (not redeclare) it; runtime values are equal; `parseLineItems`'s validation boundary tracks the live imported value | structural (TypeScript AST, self-tested against 4 synthetic fixtures) + runtime + behavioural, combined in one script | the partial-fix self-test fixture (import present, old literal left behind) must trip both detectors; an unrelated differently-named constant must NOT false-positive |

## Red evidence — observed 2026-08-20, against the unmodified tree

`npx tsx contracts/checks/ticketing-line-item-cap-drift-guard/check-single-sourced-cap.mjs` —
**exit 1**. Zero self-test failures printed (the four synthetic-fixture checks all pass, proving
the AST detectors discriminate correctly). Six real failures against the current tree, all
expected for a fix that has not been implemented yet: `lib/tickets-constants.ts` has no
numeric-literal `MAX_LINE_ITEMS` declaration; neither `lib/cart.ts` nor
`app/api/tickets/checkout/route.ts` imports it from there; both still declare their own local
numeric literal; and the runtime import of `MAX_LINE_ITEMS` from `lib/tickets-constants.ts`
fails outright (module does not export it). This is the expected, correct form of red for a fix
that does not exist yet — produced with `npx tsx` only, parsing real source files and importing
real modules in a Node context; no live Firestore, Sanity, network, or browser was used.

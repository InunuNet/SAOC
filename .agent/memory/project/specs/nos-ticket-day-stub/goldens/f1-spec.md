# r45 nos-ticket-day-stub: F1 spec (architect, 2026-10-22)

Sources: `.tmp/sandbox/queue/r45-ruling.md` (saoc-82 relaying Codi route 45, P1; saoc-82's approval of the fan fix; Codi's ruling
"TicketCard IN r45"; saoc-82's server check). BASE origin/main `1a7479f1`. Branch `fix/nos-ticket-day-stub`.

## Root cause (confirmed on BASE, both builds, 1280)

`components/tickets/keepsake/TicketMini.tsx:22-24` computes
`showDayStub(firstSelectableDay(vm.days) ?? vm.days[0]?.day ?? '')` whenever `vm.days` exists, and lines 33-34 prefer it over
`product.numeral` / `product.caption`. Only the Day Pass has `vm.days` (`lib/data/ticket-card-view-models.ts:235`), so its fan mini
reads "24 / Friday" over `TICKET_PRODUCTS.day` numeral `''` / caption `''`. Not a Sanity override and not a data fallback: a
presentation default in the component. The hub card had the same default one level down: `TicketCard.tsx:116-118` started the day
state at `firstSelectableDay(vm.days)`, so Friday was pre-checked, the stub read "24 / Friday" and Buy linked `&day=2027-09-24`.

Measured on BASE (public and preview): fan mini `day` = `["24","Friday"]`; card `#ticket-day` stub `["24","Friday"]`, radio
2027-09-24 checked, Buy `/tickets/early-bird?quantity=1&day=2027-09-24`.

## What changes (exact edits: goldens/f1-edits.json, BASE numbering)

| file | change |
|---|---|
| `TicketMini.tsx` | stub = `product.numeral` / `product.caption` only; `showDayStub`, `firstSelectableDay` imports and the `dayStub` block go |
| `TicketCard.tsx` | day state starts at `summary ? summaryDay : null` (no default); stub = `day ? showDayStub(day) : null` falling back to the product's own; Buy with no day: `showDayMissing()` sets `dayMissing` and focuses the first enabled radio; the picker gets `invalid` (`aria-invalid` on the fieldset) and a `role="alert"` `<p>` reading `{TICKET_COPY.chooseDay}` |
| `BuyBlock.tsx` | optional `onMissingDay`; when given and no day is chosen, the CTA click is `preventDefault`ed and handed to the card. The CTA stays an enabled link |
| `days.ts` | `firstSelectableDay` deleted (both callers gone); header comment corrected |

No new copy: the error text is the picker's own legend `TICKET_COPY.chooseDay` ("Choose a day"). No new visual: the error `<p>` is
`TicketFormField.tsx`'s required-field alert (`role="alert"`, class `border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px]
text-primary-800`, with `aria-invalid` on the control), plus `mt-1.5`, the 6px `space-y-1.5` gap that field puts between control and
alert. Focus goes to the first enabled day radio (the first invalid control of the group, standard form-error practice).

## Scope decisions (the lead asked for each)

| surface | in r45? | why |
|---|---|---|
| hero fan / masthead (`TicketMini` via `TicketFan` via `TicketsMasthead`) | yes | the approved fan fix; the masthead has no stub of its own |
| hub `TicketCard` default variant, `requiresDaySelection` products (the Day Pass: the only card with `vm.days`) | yes | Codi's ruling |
| Weekend Pass, VIP, Sunset, programme cards | no change | fixed numerals; pinned by f1-rendered R5 and nonreg |
| `TicketCard` summary variant (checkout, `CHECKOUT_DAY_EVENT`) | unchanged behaviour | its day comes from the page (`summaryDay`) and the form's event; the new stub expression renders exactly what BASE did for it (BASE summary `vm.days` is `null`). From the hub it now always arrives with the buyer's own `?day` |
| checkout page `summaryDay = day ?? showDays[0]` and `TicketPurchaseForm.startDay` (`showDays[0]`) | **no, DECISION NEEDED** | same "never pre-select" heuristic, but the ruling names TicketCard and the hub Buy only; changing the checkout form also needs a submit-time error the ruling did not specify. Pinned unchanged (S5, nonreg `/tickets/early-bird?quantity=1`) |
| server (saoc-82) | test only | `route.ts:701-707` already 400s a `requiresDaySelection` item with no `chosenDay` before `reserveTicket` and `paymentProvider.initiate`; nothing defaults it. `checks/f1-server.mjs` locks that in |
| ticket-pdf D11 `lib/ticket-pdf-schedule.ts` | not reused | still only on `origin/feat/ticket-pdf` at spec time (not on origin/main). It resolves a printed date line (`kind`, `dateText`, `metaText`), not a stub numeral/caption, so it does not fit the stub; the rule it encodes (a day product shows its own data until a day is chosen) is the same one applied here |
| product names ("VIP Ticket" vs "VIP Opening") | no | copy decision for Brad/Lee-Ann |

## Checks (QA inputs, hash-locked by goldens/checks-f1.sha256)

Run from the checkout under test (the r45 worktree). The rendered checks need the Chrome shim:
`NODE_OPTIONS='--require ../r19-chrome/use-chrome.cjs'` (relative: a path with spaces broke `next build`; `_server.mjs` never passes
the caller's NODE_OPTIONS to the build or the server). The beta basic-auth header goes to the local origin only (`authorize()`).

- `footprint.mjs`: only the four files, `docs/nos-ticket-day-stub.md` and this spec dir differ from BASE.
- `f1-static.mjs`: S1 exact edits; S2 fan reads the product only; S3 no default-day helper anywhere; S4 reused copy and pattern, no new
  prose; S5 out-of-scope files equal BASE; S6 docs.
- `f1-server.mjs` (`pnpm exec tsx`): V1-V3 pure validators keep an absent day absent and reject null/empty/malformed; W1-W3 route
  wiring (flag from Sanity, the 400 precedes reservation and payment, no default anywhere on the path).
- `f1-rendered.mjs`: public + preview builds, 1280 + 390, the hub and the Day Pass checkout: R1 fan, R2 unchosen, R3 error (click and
  Enter; aria-invalid, one alert "Choose a day" in the pattern class 6px under the row, focus on the first enabled radio, axe clean),
  R4 chosen (stub, href, checkout summary and form), R5 the other cards, R6 overflow. Element screenshots of unchosen/error/chosen go
  to `.tmp/tds-shots/` (for Codi).
- `nonreg.mjs`: 9 ticket routes x 2 widths x 2 builds vs `goldens/nonreg-baseline.json` (BASE capture), Day Pass card and fan mini
  masked.

## Proof (architect, 2026-10-22)

BASE: static FAIL (S1-S4, S6), rendered FAIL (R1 fan "24/Friday", R2 pre-selected Friday and `&day=` in Buy, R3 Buy navigates, R4 no
aria-invalid), footprint and nonreg PASS, server PASS (it is a guard; it passes on BASE by design). Mutation: removing the route's
`!lineItem.chosenDay` guard and defaulting `resolveChosenDayForPosition` to a date both make `f1-server.mjs` FAIL (V2, W2, W3).
Golden edits applied in a throwaway worktree: footprint, static, server, rendered (incl. axe on the error state) and nonreg all PASS;
prettier, eslint and `tsc --noEmit` clean.

Known limit: a middle-click (auxclick) on Buy with no day still opens `/tickets/<slug>?quantity=1`, which lands on the checkout's own
Friday default (the out-of-scope item above).

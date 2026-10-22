# r45b nos-ticket-day-stub: F2 spec (architect, 2026-10-22)

Source: `.tmp/sandbox/queue/r45-ruling.md`, "r45b — Codi DECISION (2026-10-22), verbatim": the checkout form has no default day
either. Same branch and PR as r45 (F1). BASE origin/main `1a7479f1`; F2 is applied on top of F1.

## Root cause

`TicketPurchaseForm.tsx:45` `startDay` falls back to `showDays[0]`, and `app/(marketing)/tickets/[slug]/page.tsx:176` sets
`summaryDay = day ?? showDays[0]`. So `/tickets/<day pass>?quantity=1` with no `?day` (a direct link, a refresh, a middle-click on
the hub's Buy) opened with Friday checked and the summary stub reading "24 / Friday". Measured on F1-HEAD, both builds.

## What changes (exact edits: goldens/f2-edits.json, BASE numbering)

| file | change |
|---|---|
| `TicketPurchaseForm.tsx` | `startDay` returns the `?day` the link named or `null`, never `showDays[0]`. New `dayGroupRef`, `dayRequested`, `dayInvalid`. `handleSubmit` first: a day product with no day sets `dayRequested`, focuses the first enabled day radio and returns (no quantity hint, no attendee validation, no request). The fieldset gets `ref` and `aria-invalid={dayInvalid}`; after the day row, `role="alert"` `<p>` with `{TICKET_COPY.chooseDay}` in r45's class. "Continue to payment" keeps `disabled={submitting}` only |
| `page.tsx` | `summaryDay = cardData.requiresDaySelection ? day : null`. With no `?day` the summary TicketCard gets `null`, so (F1) its stub is the product's own `''` / `''` and its when line is `TICKET_PRODUCTS.day.when`, "Friday, Saturday or Sunday" |

The error is r45's, byte for byte: text `TICKET_COPY.chooseDay` (the "Choose a day" legend), class
`mt-1.5 border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px] text-primary-800` (TicketFormField's alert plus its
`space-y-1.5` gap), `aria-invalid` on the fieldset. "Focus to the group" is implemented as F1 does it: focus moves to the group's
first enabled radio, which is how a radio group takes focus. With `?day` the day is pre-selected as before. The mouse-click focus
ring is accepted (Codi).

## Amendments to F1 (so F1 stays green with F2 applied)

- `_lib.mjs` footprint allowlist: f1 + f2 footprints.
- `f1-static.mjs` S5: the checkout form and page leave the untouched list (f2-static S1 pins them exactly).
- `nonreg.mjs` + `nonreg-baseline.json`: `/tickets/early-bird?quantity=1` (both widths, both builds) removed; f2-rendered owns it.
  The `&day=2027-09-25` route stays and stays identical.
- `f1-rendered.mjs` and `f2-rendered.mjs`: the pointer moves to (0, 0) before each screenshot, so no day cell shows a hover border.
- `_server.mjs`: the build stamp also carries a source fingerprint (a hash of the diff and changed files against BASE). The mtime
  test alone reused a stale F2 build after the files were reverted to BASE (a revert drops a path from the changed set), which made
  f2-rendered pass on F1-HEAD; with the fingerprint any source change, a revert included, forces a rebuild.
- `contract-f1.yaml`, `f1-spec.md`: descriptions follow. `checks-f1.sha256` is re-hashed.

## Checks (QA inputs, hash-locked by goldens/checks-f2.sha256)

- `f2-static.mjs`: S1 exact edits; S2 no `showDays[0]`, startDay/summaryDay shapes; S3 r45's class and text, aria-invalid on the
  fieldset, submit still only `disabled={submitting}`, no new prose; S4 docs mention r45b, TicketPurchaseForm.tsx, summaryDay.
- `f2-rendered.mjs` (public + preview, 1280/390; slugs read from the hub; POST /api/tickets/checkout aborted for the context and
  any attempt fails): C1 no `?day` (nothing checked, summary `''`/`''` and "Friday, Saturday or Sunday", no error, button enabled);
  C2 submit with no day by click and by Enter (stays, no request, aria-invalid, one alert 6px under the row, focus on the first
  enabled radio, button enabled, axe clean); C3 choosing a day clears it and drives the summary; C4 `?day` pre-selects; C5 the
  Weekend Pass checkout has no picker and keeps its stub; C6 overflow. Shots: `.tmp/tds-shots/f2-*.png`.
- Also run under contract-f2: footprint, `f1-server.mjs` (kept), eslint on the two files, `tsc`, and `nonreg.mjs`.

## Proof (architect, 2026-10-22)

F1-HEAD = the dev's `18ab946f` (fresh builds): f2-static FAIL (S1-S4), f2-rendered FAIL (C1 Friday pre-selected and summary
"24/Friday", C2 no aria-invalid/alert and focus left on the button, C3 no aria-invalid) with C4, C5 green and no checkout request.
With the F2 golden edits on F1-HEAD: f1-static, f2-static, footprint, f1-server, f1-rendered, f2-rendered and nonreg PASS; prettier,
eslint (the two files) and `tsc --noEmit` clean.

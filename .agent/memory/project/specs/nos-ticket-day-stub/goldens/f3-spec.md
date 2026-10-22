# nos-ticket-day-stub F3: the required-field alert reads as an error (architect, 2026-10-22)

Source: `.tmp/sandbox/queue/r45-ruling.md`, "Codi on f090281f (2026-10-22): behaviour PASS; F3 fix before PR", verbatim: the
"Choose a day" alert "renders as a plain outlined box in body ink, which looks exactly like an empty input or a fourth option".
Make TicketFormField's alert class visibly an error, fixed once in the class so every form inherits it: text and a 2px left border
in an error colour, a leading ⚠ icon (aria-hidden), no box outline; the day group's option borders take the same colour while it is
aria-invalid. Colour: the admin ruling's one token, `--color-error: #9b2c2c` in `app/globals.css` `@theme`
(`.agent/memory/project/specs/admin-redesign/goldens/table-columns.md`, "Codi token rulings (final)"). Same branch and PR as F1/F2.
Added by team-lead (2026-10-22): Codex P2 on `BuyBlock.tsx:158`, verbatim: "The missing-day click handler calls `preventDefault()`
even for Ctrl/Cmd/Shift/Alt-clicks, preventing expected modified-click link navigation. Only ordinary primary activation should be
intercepted for the inline validation."; and the token must tolerate admin-redesign PR #28 adding the identical line.
F3 is applied on top of F2 (`f090281f`).

## Root cause

The class `border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px] text-primary-800` was copied into four ticket alerts
(TicketFormField, the hub card's day picker, the checkout's day picker, the checkout's cart error). In the NOS theme `--bone` is
`#f3f2d6`, the card's own fill, so on the card the alert was a 1px ink-coloured outline around ink text: the shape of an input or
a fourth option, with no error signal.

## What changes (exact substitutions: goldens/f3-edits.json, applied after the F1/F2 edits)

| file | change |
|---|---|
| `components/tickets/TicketFormField.tsx` | New exported `TicketFieldAlert({ children, spaced })`: `<p role="alert">` with the one class `flex gap-2 border-l-2 border-error bg-bone px-4 py-3 font-sans text-[14px] text-error` (`mt-1.5` prepended when `spaced`), a first child `<span aria-hidden="true">` holding `'⚠︎'` (the text-presentation warning sign, so it takes the error colour rather than an emoji's) and a `<span>` with the children. TicketFormField's own error renders `<TicketFieldAlert>{error}</TicketFieldAlert>` |
| `components/tickets/keepsake/TicketCard.tsx` | imports TicketFieldAlert; the picker's alert is `<TicketFieldAlert spaced>{TICKET_COPY.chooseDay}</TicketFieldAlert>` |
| `components/tickets/TicketPurchaseForm.tsx` | imports TicketFieldAlert; the day alert is `<TicketFieldAlert spaced>{TICKET_COPY.chooseDay}</TicketFieldAlert>`, the cart error `<TicketFieldAlert>{cart.errorMessage}</TicketFieldAlert>` |
| `components/tickets/keepsake/BuyBlock.tsx` | `import { useState, type MouseEvent } from 'react'`; new `isPlainClick(event)` (button 0, no meta, ctrl, shift or alt) after `checkoutHref`; the missing-day handler starts `if (!isPlainClick(event)) return;`, so a modified click opens the checkout as a link (where r45b's no-default-day error asks for the day) and only a plain click or keyboard Enter is held |
| `app/globals.css` | `--color-error: #9b2c2c;` in `@theme`, after `--color-rule-soft` (gives `text-error` / `border-error`). Not an exact edit (`tokenEdit`, not `substitutions`): f3-static S3 asserts the declaration once, inside `@theme`, with that value, and that globals.css otherwise equals BASE or origin/main. If PR #28 lands first, the rebase keeps #28's line, drops ours, and the check still passes |
| `app/(marketing)/national-show/nos-structure.css` | after `.nk-day span.nk-sub`: `.nos-theme .nk-days[aria-invalid='true'] .nk-day { border-color: var(--color-error); }`. One rule covers both pickers (both are `fieldset.nk-days`); specificity 0,4,0 beats `.nk-day:hover`. Both components derive aria-invalid from "no day chosen", so picking a day clears it |

What stays: the copy (TICKET_COPY.chooseDay), the `bg-bone` fill and padding, 14px, the 6px `mt-1.5` gap below the day row,
aria-invalid on the fieldset, focus behaviour. No other new colour or hex; the sign is the ruling's own ⚠.

## Contrast (S4 static from the theme files, E1/E2 rendered from computed styles)

`#9b2c2c` against: SAOC bone `#e8e6dc` 6.01, SAOC parchment/ivory `#f4f3ec` 6.77, NOS bone (the card gold) `#f3f2d6` 6.62, NOS
parchment/ivory and gold-100 `#fbfaf0` 7.18, pale gold `#f3f2d6` 6.62. All clear 4.5:1 for text and 3:1 for the borders.

## Amendments to F1/F2 (so they stay green with F3 applied)

- `_edits.mjs` `exactEdits`: after the BASE line edits, the `substitutions` of goldens/f3-edits.json are applied (each `from` must
  occur exactly once), so F1's and F2's exact-edit checks expect the F3 text of TicketCard and TicketPurchaseForm.
- `_lib.mjs` footprint allowlist: f1 + f2 + f3 footprints.
- `f1-static.mjs` S4/S5: TicketFormField leaves the untouched list (f3-static pins it exactly); the reused pattern is
  TicketFieldAlert; the card renders it spaced.
- `f2-static.mjs` S3: the day error is `<TicketFieldAlert spaced>`.
- `f1-rendered.mjs` R3, `f2-rendered.mjs` C2: the alert's class is `goldens/f3-edits.json` `spacedClass`, its readable text leaves
  out the aria-hidden sign, and (F1) the computed border is a 2px solid left border with 0px on top.
- F1/F2 goldens (`f1-edits.json`, `f2-edits.json`) are unchanged: their `errorClass` records what F1/F2 shipped.

## Out of scope (team-lead: confirmed out of r45, queued as rFE)

The same outlined class is also hand-copied, at other sizes, in `components/contact/ContactForm.tsx:186` and
`components/members/SuggestionForm.tsx:163` (SAOC forms, 16px / leading-[1.55]) and
`components/tickets/DownloadTicketButton.tsx:117` (13px, `mt-2`, the post-purchase download failure). They are not
TicketFormField's and are not on the ticket checkout path. f3-static S5 pins them at BASE. `VendorRegisterStatusBanner.tsx` and the admin pill are different uses.

## Checks

f3-static.mjs (S1 exact, S2 defined once, S3 the token (tolerant of #28), S4 contrast, S5 out of scope + NO INVENTION, S6 docs, S7
modified clicks) and f3-rendered.mjs (public build, 1280/390, hub card and checkout: E1 alert colour/border/outline/sign/text/
contrast, E2 the invalid group's option borders, E3 axe, E4 picking a day restores the options, E5 hub only: ControlOrMeta- and
Shift-click on Buy with no day reach window with defaultPrevented false and show no error, before the plain click shows it). Element shots: `.tmp/tds-shots/f3-<width>-<hub|checkout>-error.png`.

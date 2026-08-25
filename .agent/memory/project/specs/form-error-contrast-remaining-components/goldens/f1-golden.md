---
mission: form-error-contrast-remaining-components
milestone: M1
features: [F1]
date: '2026-08-25'
---

# F1 Golden — extend F3's bordered-callout error pattern to 3 remaining components

Verified against the actual current source on 2026-08-25 (not the backlog/mission
brief's possibly-drifted description).

## Confirmation: F3 (backlog-a11y-ui-quickfixes) has already landed

`components/contact/ContactForm.tsx:166` and `components/tickets/TicketPurchaseForm.tsx:99,105`
already carry the bordered-callout pattern in the working tree:

```
<p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[Npx] text-primary-800">
```

This is the exact, only pattern to reuse. See
`contracts/golden/form-error-contrast-remaining-components-f1/pattern.md` for the
full verbatim reference and per-component target markup — that file is the
authoritative source @dev must copy from.

## Confirmation: all three target components genuinely still have the defect

All three read `text-accent` on a real, reachable error state as of 2026-08-25 —
this is not a stale backlog item:

- `components/tickets/CartDayPicker.tsx:76` — `<p className="font-sans text-[13px] text-accent">{error}</p>`, no `role="alert"`. Reachable when a `requiresDaySelection` ticket type has quantity > 0 and its per-unit day `<select>` is left empty at submit.
- `components/tickets/TicketFormField.tsx:38` — `<p className="font-sans text-[13px] text-accent">{error}</p>`, no `role="alert"`. Reachable via TicketPurchaseForm's name/email fields on invalid/empty submit.
- `components/tickets/DownloadTicketButton.tsx:115` — `<p role="alert" className="mt-2 font-sans text-[13px] text-accent">`. Already has `role="alert"`, keep it. Reachable when `handleDownload` throws (QR image load failure, missing canvas context, or `toBlob` returning null) — harder to trigger through the real UI than the two form fields; a devtools-forced trigger (e.g. temporarily breaking `qrDataUri`) is acceptable for the browser-verification step.

No stale/already-fixed cases found among the three — do not skip any of them.

## What "done" looks like per component

Each of the three files:
1. No longer contains `text-accent` anywhere (mirrors F3's A7/A9-style check).
2. Its error `<p>` carries `border`, `border-primary-800` (or combined `border
   border-primary-800`), `bg-bone`, and `text-primary-800` together on the same
   element (mirrors F3's A8/A10-style check).
3. Carries `role="alert"` on that same `<p>` (already true for
   DownloadTicketButton; net-new for CartDayPicker and TicketFormField as part
   of matching the precedent's full markup, not a separate design decision).
4. Preserves its own existing text size (`text-[13px]` for all three — verified
   above, do not change).

## Regression guard

- `components/contact/ContactForm.tsx` and `components/tickets/TicketPurchaseForm.tsx`
  must be byte-for-byte unchanged by this mission (F3 already fixed them; this
  mission's diff must not touch these two files at all).
- Each target component's non-error rendering (labels, inputs, selects, the
  download button itself, day options) must be visually and structurally
  unchanged — only the conditional error `<p>` markup changes.
- `contracts/golden/wcag-accent-contrast/` (the separate, HELD, broader
  token-level contrast audit mission) must not be touched or referenced as if
  it were this mission's scope.

## Browser verification (mandatory, real BrowserAgent — see contract A-series + H1)

Trigger each of the three real error states in the running app (not a synthetic
DOM injection) and screenshot at 375px and desktop widths, confirming the
bordered-callout box (bone background, dark bordered rule, dark readable text)
renders and looks visually consistent with the already-fixed ContactForm /
TicketPurchaseForm treatment:

1. Ticket purchase flow: select a `requiresDaySelection` ticket type, increase
   quantity, submit without choosing a day → CartDayPicker's per-row error.
2. Ticket purchase flow: submit with an empty/invalid name or email →
   TicketFormField's error.
3. Confirmation/ticket page: trigger `DownloadTicketButton`'s error path
   (devtools-forced acceptable per the note above) → its error callout.

Record pass/fail per component per width in the mission checkpoint notes.

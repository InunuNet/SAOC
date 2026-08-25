# Bordered-callout error pattern — verbatim, from F3 (backlog-a11y-ui-quickfixes)

This is the EXACT, already-approved and already-shipped markup pattern. Copy it
verbatim into the three target components below. Do not restyle, do not invent a
new colour, do not add new tokens — this is a reuse task, not a design task.

## The pattern (as it exists today in ContactForm.tsx and TicketPurchaseForm.tsx)

```tsx
<p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[Npx] text-primary-800">
  {errorMessage}
</p>
```

Where `text-[Npx]` is whatever size the original error paragraph already used
(13px or 14px depending on the component — preserve each component's existing
size, do not standardize to a new one).

Verified live at these exact locations (2026-08-25):
- `components/contact/ContactForm.tsx:166`
- `components/tickets/TicketPurchaseForm.tsx:99` (cartError)
- `components/tickets/TicketPurchaseForm.tsx:105` (errorMessage)

Signature classes that MUST all be present together on each target's error
element after the fix:
- `border border-primary-800` (or `border-primary-800` combined with a bare
  `border` utility — the two together produce the visible rule)
- `bg-bone`
- `text-primary-800`

And the low-contrast class that MUST be gone from each target file entirely:
- `text-accent`

## Contrast math

`--primary-800: #22281f` (near-ink sage) on `--bone: #e8e6dc` — this exact
pairing already measures 13.6:1 in the F3 precedent (DoorResultBanner.tsx /
LoginFormFields.tsx), far above the WCAG AA 4.5:1 threshold. Reusing it verbatim
is sufficient to satisfy AA; no new contrast math is needed, only confirmation
via `check_contrast.py` that the token pairing hasn't drifted since F3.

## Per-target notes

### CartDayPicker.tsx (`components/tickets/CartDayPicker.tsx:76`)

Current (bad):
```tsx
{error ? <p className="font-sans text-[13px] text-accent">{error}</p> : null}
```

Target:
```tsx
{error ? <p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[13px] text-primary-800">{error}</p> : null}
```

Note: unlike ContactForm/TicketPurchaseForm, this error `<p>` currently has no
`role="alert"`. Add it as part of this fix — it's a one-line addition that
matches the precedent's markup exactly and costs nothing extra; the F3 precedent
established `role="alert"` as part of the pattern, not an unrelated change.

Error is triggered by validation on the day-select `<select>` inside
`CartDayPicker` — reachable in the real ticket purchase flow when a
`requiresDaySelection` ticket type has quantity > 0 and a day is left
unselected at submit.

### TicketFormField.tsx (`components/tickets/TicketFormField.tsx:38`)

Current (bad):
```tsx
{error ? <p className="font-sans text-[13px] text-accent">{error}</p> : null}
```

Target:
```tsx
{error ? <p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[13px] text-primary-800">{error}</p> : null}
```

Same `role="alert"` note as CartDayPicker above.

`TicketFormField` is the shared name/email input used inside
`TicketPurchaseForm` — its error state triggers on submit with an invalid or
empty name/email value.

### DownloadTicketButton.tsx (`components/tickets/DownloadTicketButton.tsx:114-118`)

Current (bad):
```tsx
{status === 'error' ? (
  <p role="alert" className="mt-2 font-sans text-[13px] text-accent">
    Couldn&apos;t prepare the download. Please try again, or use the QR code above.
  </p>
) : null}
```

Target:
```tsx
{status === 'error' ? (
  <p role="alert" className="mt-2 border border-primary-800 bg-bone px-4 py-3 font-sans text-[13px] text-primary-800">
    Couldn&apos;t prepare the download. Please try again, or use the QR code above.
  </p>
) : null}
```

This one already has `role="alert"` — preserve it, and preserve the `mt-2`
spacing utility (it separates the callout from the button above it; the F3
precedent files don't need this because their errors aren't adjacent to a
sibling button in the same way, so `mt-2` is a legitimate DownloadTicketButton-
specific addition to the shared pattern, not a deviation from it).

Error state triggers when `handleDownload` throws (QR image fails to load, no
canvas 2D context, or `canvas.toBlob` returns null) — reachable in dev by
temporarily breaking `qrDataUri` (e.g. via browser devtools) or by mocking a
canvas failure; a real end-to-end trigger is harder to force than the two form
fields above, so the browser-verification instruction (H1) allows a
devtools-forced trigger for this one component specifically.

## Explicitly out of scope (do not touch)

- `components/contact/ContactForm.tsx` and `components/tickets/TicketPurchaseForm.tsx`
  — already fixed by F3, must remain byte-for-byte unchanged by this mission.
- Any `text-accent` usage in this codebase that is NOT one of the three error
  paragraphs above (e.g. `text-accent` used for eyebrow labels, buttons,
  non-error decorative text) — out of scope, do not touch.
- `contracts/golden/wcag-accent-contrast/` — that mission is a broader,
  separate, HELD token-level contrast audit. Do not merge scope with it, do not
  edit its files.

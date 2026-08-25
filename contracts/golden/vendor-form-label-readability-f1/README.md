# Golden: vendor-form-label-readability F1

## Scope decision (read first)

backlog.md flagged this as a vendor-form P2 defect, but the exact class string
`font-mono text-[11px] uppercase tracking-[0.16em]` is **not vendor-scoped** — it is a
site-wide typographic pattern, copy-pasted literally (no shared label component) across 30
files / 40 locations. backlog.md's own wording for this item is unconditional: "a fix must
not silently diverge the vendor form's typography from the rest of the site." Orchestrator
decision (2026-08-25): fix all 40 locations, not just the 4 vendor components.

## The fix

Remove exactly one utility class, `uppercase`, from each of the 40 locations below.
Do NOT touch anything else in the class string:

- Keep `font-mono` (font family)
- Keep `text-[11px]` (font size)
- Keep `tracking-[0.16em]` (letter-spacing) — unchanged, per Brad's recommendation to
  preserve the mono/letter-spacing character
- Keep every colour/contrast class (`text-muted`, `text-ivory`, `text-accent`,
  `text-red-700`, `text-ink`, etc.) — contrast already passes (5.24:1); colour is not the
  problem and must not be touched
- Keep every other utility (spacing, layout, hover/focus states) exactly as-is

Before: `font-mono text-[11px] uppercase tracking-[0.16em]`
After:  `font-mono text-[11px] tracking-[0.16em]`

(Whitespace: removing `uppercase` also removes the single space before or after it — normal
JSX/string className cleanup, not a separate concern.)

No label/legend/caption TEXT strings need editing anywhere in this list. Every label string
checked is already authored in sentence case in source (e.g.
`components/vendors/VendorContactFieldset.tsx` passes
`label="Vendor / business name"`, `label="Cell phone contact number"`, etc.) — `uppercase`
is a pure CSS transform of that source text, so removing the utility class is sufficient on
its own; the rendered text becomes readable sentence case automatically.

## Exact locations (30 files, 40 occurrences)

Format: `file:line` — context

```
app/admin/settings/page.tsx:122
app/admin/settings/page.tsx:128
app/admin/settings/page.tsx:136
app/admin/settings/page.tsx:155
app/admin/settings/page.tsx:160
app/admin/login/LoginFormFields.tsx:20
app/admin/login/GoogleSignInButton.tsx:64
app/(marketing)/societies/SocietiesClient.tsx:78
app/(marketing)/societies/SocietiesClient.tsx:79
app/(marketing)/contact/page.tsx:77
app/(marketing)/media-kit/page.tsx:49
app/(marketing)/judging/page.tsx:98
app/(marketing)/privacy/page.tsx:171
app/(marketing)/terms/page.tsx:115
app/(marketing)/constitution/page.tsx:48
app/(marketing)/refunds/page.tsx:103
app/(marketing)/national-show/page.tsx:355
app/(marketing)/national-show/archive/[year]/page.tsx:171
components/tickets/CartAttendeeFields.tsx:47
components/tickets/TicketFormField.tsx:25
components/tickets/OzowSandboxTestModeBanner.tsx:37
components/tickets/TicketPurchaseForm.tsx:49
components/tickets/TicketPurchaseForm.tsx:67
components/tickets/CartDayPicker.tsx:42
components/tickets/CartDayPicker.tsx:54
components/tickets/DayQuantityPicker.tsx:20
components/vendors/VendorFormField.tsx:19
components/vendors/VendorRadioGroupField.tsx:19
components/vendors/VendorBooleanRadioField.tsx:20
components/vendors/VendorCheckboxGroupField.tsx:19
components/show/ExhibitorSteps.tsx:59
components/contact/ContactForm.tsx:71
components/show/ExhibitorKeyDates.tsx:61
components/show/ExhibitorKeyDates.tsx:69
components/show/ExhibitorKeyDates.tsx:75
components/show/ExhibitorKeyDates.tsx:81
components/show/VenueCard.tsx:90
components/admin/TicketsTable.tsx:5
components/admin/DoorScannerClient.tsx:213
components/admin/VendorReviewTable.tsx:9
```

This list was produced by:

```
grep -rn "font-mono text-\[11px\] uppercase tracking-\[0.16em\]" --include="*.tsx" --include="*.ts" . \
  | grep -v '/node_modules/' | grep -v '\.agent/golden/' | grep -v 'contracts/golden/'
```

Excluded deliberately: `.agent/golden/**` and `contracts/golden/**` — these are frozen
historical golden snapshots from prior missions, not live application source. Do not edit
them for this feature.

Line numbers are as of 2026-08-25 and may drift by a line or two if an unrelated edit lands
first — @dev should re-run the grep above and match against the class string, not blindly
trust line numbers if a file has changed shape.

## Out of scope — do not touch

- Any occurrence of `font-mono text-[11px] uppercase` with a **different** tracking value
  (e.g. `tracking-[0.14em]`, `tracking-[0.18em]`, `tracking-[0.1em]`, `tracking-[0.2em]`,
  `tracking-[0.22em]`) — these are a related but visually distinct treatment (wider spacing
  at 11px reads differently) and were not the subject of Brad's complaint or this contract.
  Leave them exactly as they are.
- Any colour or contrast class anywhere in the diff.
- Any label/legend/caption text string.
- `.agent/golden/**`, `contracts/golden/**` (frozen snapshots).

## Verification

- A1: zero remaining occurrences of the literal string
  `font-mono text-[11px] uppercase tracking-[0.16em]` in live `.tsx`/`.ts` source
  (excluding golden snapshot directories).
- A2: exactly 40 occurrences of `font-mono text-[11px] tracking-[0.16em]` (without
  `uppercase`) in the same scope — proves the fix landed everywhere, not just some subset,
  and that nothing else in the string was altered on the way.
- A3: pairwise diff check across all 40 changed lines (not a sample) —
  `contracts/checks/vendor-form-label-readability-f1/check-uppercase-only-diff.sh` strips the
  literal "uppercase " token from each removed line and asserts the result is byte-identical
  to the corresponding added line, proving no colour/contrast class, tracking value, or any
  other token changed anywhere in the diff. (An earlier version of this check grepped the
  diff for colour-token substrings; it was replaced because an unchanged colour token appears
  on both the `-` and `+` side of a line that only dropped `uppercase `, so that grep matched
  every touched line regardless of correctness and could never fail on a correct
  implementation.)
- A4 (behavioural, Playwright): load `/national-show/vendors/register`, `/contact`, and
  `/national-show` (all public, no auth needed) and assert computed
  `getComputedStyle(el).textTransform === 'none'` on a representative label/legend element
  on each page, while `getComputedStyle(el).fontFamily` still matches the mono stack and
  `letterSpacing` remains unchanged from its current value (assert it is non-zero /
  unchanged, not a specific pixel value, since Tailwind may compute it slightly differently
  across environments — the point is it wasn't accidentally stripped alongside
  `uppercase`).

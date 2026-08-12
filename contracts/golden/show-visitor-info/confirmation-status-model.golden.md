# Confirmation-status model — how "pending" is shown

## The posture being encoded

The ticketing mission's lesson, restated: **ship visibly-pending content, never plausible
invention, because this goes in front of the council.** Ticket prices carry
"Provisional price — pending council confirmation." Every unconfirmed value on the visitor pages
carries an equivalent marker.

There is a second, distinct category here that ticketing did not have. Brad's instruction splits
the content three ways, and the model must too:

| Status | Means | Example |
|--------|-------|---------|
| `pending` | Placeholder. We made it up as scaffolding. The committee must supply the real value. | Opening hours, parking specifics, admission conditions, photography policy, cloakroom, most FAQ answers |
| `research` | Real, verified by us against the CTICC working assumption — but *our* research, not committee-confirmed. Correct today, invalid the day the venue changes. | Airport routes, public transport, accommodation, attractions |
| `confirmed` | The committee supplied or signed off this value. Renders with no marker. | Nothing yet. |

Conflating `pending` and `research` would be dishonest in both directions: it would label
verified MyCiTi timetable data as invented, and it would let researched-but-unconfirmed
accommodation read as committee-endorsed.

## How it is modelled

Two schema pieces, both on `showVisitorInfo`:

1. **Two label strings**, so the wording is editable in one place and reused everywhere:
   - `pendingLabel`, seeded `"To be confirmed by the show committee"`
   - `researchLabel`, seeded `"Researched by the web team against the working venue — not yet confirmed by the show committee"`
2. **A `confirmations` object**, one `string` field per content block, each with
   `options.list: ['pending', 'research', 'confirmed']`, `initialValue: 'pending'`.

Field list on `confirmations` (13 blocks):

```
venue  dates  openingHours  admission  parking  publicTransport  accessibility
photography  cloakroom  food  accommodation  attractions  emergencyContacts
```

`showFaq` documents carry their **own** `status` field with the identical three-value list and
the same `initialValue: 'pending'` — FAQs are individual documents, so a per-document status is
the only shape that lets the committee confirm answers one at a time.

## How it renders

One shared server component, `components/show/ConfirmationBadge.tsx`:

```
<ConfirmationBadge status={info.confirmations.parking} pendingLabel={...} researchLabel={...} />
```

- `status === 'confirmed'` → renders `null`. Nothing.
- `status === 'pending'` → renders the `pendingLabel` text.
- `status === 'research'` → renders the `researchLabel` text.
- `status` missing/unknown → renders the **`pendingLabel`**. Fail closed. An unset status must
  never read as confirmed.
- **`pendingLabel` / `researchLabel` empty or missing → renders a built-in fallback label.**
  Also fail closed. See below.

Styling: existing Sage & Paper tokens only (`text-muted`, `font-mono`, `border-rule`,
`bg-parchment` and friends — the same vocabulary `/tickets` uses for the provisional-price
note). No new CSS custom properties, no hex literals, no new colour names.

The badge is **text, not colour alone** — a colour-only signal fails WCAG 1.4.1 and is invisible
to the council member reading a printout.

## A safety device has no off switch

**Round 1 got this wrong, and it was the mission's second overriding rule.** The component read:

```ts
const label = status === 'research' ? researchLabel : pendingLabel;
if (!label) return null;
```

It failed closed on **status** and open on **label**. `pendingLabel` was a plain `string` with no
validation at all — the schema file contained zero occurrences of `validation`. @qa cleared it in
Studio and **all 23 pending markers disappeared** across `/national-show` (1), `plan-your-visit`
(2), `what-to-expect` (7) and `faq` (13), while every `confirmations` value was still `pending`.
The site then presented unconfirmed opening hours, admission conditions, parking, accessibility,
photography policy, cloakroom arrangements and thirteen FAQ answers as settled fact.

Two changes, both required — neither is sufficient alone:

### 1. A built-in fallback in the component

```ts
const FALLBACK_PENDING_LABEL = 'To be confirmed';
const FALLBACK_RESEARCH_LABEL = 'Not yet confirmed';

if (status === 'confirmed') return null;          // the ONLY early return
const supplied = status === 'research' ? researchLabel : pendingLabel;
const label = supplied?.trim() || (status === 'research' ? FALLBACK_RESEARCH_LABEL : FALLBACK_PENDING_LABEL);
```

The fallbacks are deliberately **terse and different from the seeded wording**, so a page falling
back is visibly degraded rather than silently equivalent — an editor who clears the field sees
that something changed.

This is the load-bearing defence, because Sanity's `validation` is advisory: it warns in Studio
and does not prevent a write through the API, a migration script, or a bulk edit.

### 2. `Rule.required()` on both label fields

`validation: (Rule) => Rule.required()` on `pendingLabel` and `researchLabel`. It stops the
ordinary path — an editor clearing a field in Studio — with a visible error, which is the case
that actually happened.

### Why the old assertion had to go

Round 1's A43 ended with a grep: *"`ConfirmationBadge` must contain no literal fallback label
string."* That assertion **actively forbade the fix**. It froze today's wording into the check and
mistook "the copy is editable in Studio" for "the component must have nothing to fall back on".

The real claim — the labels come from Sanity and are not frozen into the component — is now
asserted where it is observable: on the rendered page, every badge's text must equal one of the
two *dataset* labels (`check-marker-fail-closed.mjs`, BEFORE phase). Reword either label in
Studio and the check follows it. Hardcode one in JSX and the check fails.

## Assertion consequences

- Both labels are queried and actually interpolated into JSX (the ticketing contract's
  "queried AND rendered" pattern, which caught two real bugs on this project where a field was
  fetched into a variable and never placed in JSX).
- Over real HTTP, the `pendingLabel` string *as currently stored in the dataset* must appear on
  each of the three new pages. The check reads the needle from Sanity — and **validates that
  needle before using it**, because a blank needle is what made round 1's version unfalsifiable.
- Markers are counted **structurally**, via a `data-confirmation-badge` attribute on the badge
  root. That observable is derived from neither the dataset nor the copy, so no field an editor
  can clear will ever reduce the count silently.
- The perturbation is part of the contract: clear `pendingLabel` in the dataset, and the marker
  count on all four pages must be **unchanged**.

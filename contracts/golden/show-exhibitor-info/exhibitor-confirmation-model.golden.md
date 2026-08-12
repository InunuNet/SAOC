# Exhibitor confirmation model — four values, not three

## Why this stream needs a fourth value

The visitor stream split content three ways: `pending` (we invented scaffolding), `research`
(we verified it ourselves), `confirmed` (the committee signed it off).

That model does not fit this stream, because the research report has a fourth category the
visitor research did not: **Section 12, "Explicit list of things this research could NOT
establish."** Nine items, including overnight security, watering responsibility during the show
run, insurance terms, who may build a display stand, whether exhibitors may sell from their
competitive entries, and whether any domestic South African plant-movement permit applies.

For those, we did not invent a placeholder and we did not verify a fact. We looked, and the
public record is empty. Filing that as `pending` would be a lie of omission — it implies a value
exists that simply has not been typed in yet, when what actually exists is an **open question we
need the committee to answer**. Filing it as `research` would be worse: it would present a gap as
a finding.

So:

| Status | Means | Renders as | Seeded examples |
|--------|-------|-----------|-----------------|
| `pending` | Placeholder scaffolding. A real value exists in the world; the committee must supply SAOC's. | `pendingLabel` | Entry deadline, entry fees, staging times, removal time, ownership-duration figure |
| `research` | Established international convention, verified by us against real published show rules. Offered as a **starting point to correct**, never as SAOC policy. | `researchLabel` | Exhibitor-number registration, exhibitor-classifies-own-plant rule, pest/disease inspection, labelling and nomenclature, plants stay benched for the full run, vendor sales kept separate from the judged floor |
| `question` | The research could not establish this. We are asking the committee, not telling the exhibitor. | `questionLabel` | Security, watering, insurance, loading access, display-build rules, results notification, selling from the bench, domestic permits, indigenous-species documentation |
| `confirmed` | The committee supplied or signed off this value. **Renders with no marker.** | nothing | Nothing yet. Nothing at seed time. |

## The fail-closed rule (inherited, non-negotiable)

`initialValue: 'pending'` on every status field. A missing, empty, or unrecognised status renders
the **`pendingLabel`**. An unset status can never read as confirmed. The badge component has no
branch in which an unknown value produces silence.

This is asserted twice: structurally (no `initialValue: 'confirmed'` anywhere in the schema, no
`'confirmed'` anywhere in the seed) and at the rendered level (a block whose status is garbage
still shows a marker).

## The three label strings

Editable in one place on the singleton, reused everywhere, never hardcoded in a component:

- `pendingLabel` — seeded `"To be confirmed by the show committee"`
- `researchLabel` — seeded `"Researched international show practice — a starting point for the show committee, not yet SAOC policy"`
- `questionLabel` — seeded `"Open question for the show committee — we could not establish this"`

`ExhibitorStatusBadge` contains **no literal label string**. All three arrive as props from
Sanity. Asserted by grep (structural) and by a rendered check that reads the needle live out of
the dataset, so a label frozen into JSX that happens to match today's seed cannot pass.

## Where status lives

Two shapes, and the choice between them is not stylistic:

- **Fixed singleton blocks** → one central `confirmations` object of type
  `exhibitorConfirmationStatuses`, one string field per block. The block set is fixed by the
  schema, so a central object keeps them all visible in one Studio pane and makes
  "every block has a status" a structural invariant a grep can check.
- **Array items and collection documents** (`showExhibitorDate`, `exhibitorQuestion`,
  `showExhibitorStep`) → each item carries its **own** `status` field with the identical
  four-value list and the identical `initialValue: 'pending'`. The committee confirms the staging
  time without thereby confirming the entry fee. This is exactly the rule the sibling used for
  `showFaq`.

## The block set on `confirmations` (10 blocks)

```
entryProcess   fees        classes     judging    eligibility
display        sales       practicalities         permits     entryForm
```

Every one of these names is also a field name on `showExhibitorInfo` of type
`exhibitorSection` (except `entryForm`, which governs the entry-form block). The contract asserts
the two sets match, so a section can never be added without a status and a status can never
dangle without a section.

## Styling

Sage & Paper tokens only — `text-muted`, `font-mono`, `border-rule`, `bg-bone`, `bg-parchment`,
the same vocabulary `/tickets` uses for its provisional-price note. No new CSS custom properties,
no hex literals, no new colour names.

The badge is **text, not colour alone**. A colour-only signal fails WCAG 1.4.1 and is invisible to
the council member reading a printout — which is the actual delivery format for this page's
review.

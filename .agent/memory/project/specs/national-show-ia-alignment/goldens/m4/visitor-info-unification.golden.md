# Golden — the `showVisitorInfo` question, answered (M4)

M1's `provenance-gate.golden.md` deferred this and named the consequence as limitation (d):
the site would carry two placeholder mechanisms with different guarantees. The question was
"migrate `showVisitorInfo` into `showPage`, or keep them split?" It is ours to answer, and
this is the answer.

## The decision

**Keep the documents split. Unify the mechanism.**

`showVisitorInfo` and `showFaq` keep their schemas and keep owning the structured visitor
content for spec entries 3, 16 and 17. What gets unified is the **provenance mechanism** —
one `Provenance` type, one `resolveNotice`, one notice component, one guarantee, across all
three document types.

## Why not migrate (the option that looks tidier and is worse)

`showVisitorInfo` is not a prose document. Beneath its scalar copy fields it carries five
genuinely structured arrays, each with its own object type:

| field | object type | what it holds |
|---|---|---|
| `airportRoutes` | `travelRoute` | one entry per national airport a visitor might fly into |
| `accommodation` | `accommodationOption` | places to stay, grouped by distance from the venue |
| `attractions` | `attraction` | nearby things to do |
| `openingHours` | `openingHoursEntry` | per-day hours |
| `emergencyContacts` | `emergencyContact` | name, relationship, number |

`showPage.sections[].body` is portable text. Migrating would flatten all five into prose and
lose three things at once: the council's ability to edit one accommodation entry as a
record, the templates' ability to sort and group by distance or day, and the structure spec
§4.16 explicitly asks for ("accommodation recommendations, **grouped by distance from the
venue**"). That is a data-model downgrade bought with uniformity we can get another way.

`showFaq` is a collection precisely so each question carries its own status
(`showFaq.ts:5-7` records the reasoning) — spec §4.17 wants categorised, searchable,
individually-dated answers. Folding it into a page's section array loses that too.

And the migration itself is the riskiest kind: rewriting live content the secretary has
already edited, on three pages that are already built and already correct.

## Why not simply keep them split (the option that leaves the hazard)

Because the hazard is real and is not about documents. Today there are **three** placeholder
mechanisms with three different guarantees, and a fourth on `society`:

| mechanism | shape | can it be published unset? |
|---|---|---|
| `showPage.provenance` (M1) | required enum, **no initialValue** | **no** — an explicit choice is forced |
| `showVisitorInfo.confirmations.*` | 13 fields, `initialValue: 'pending'` | yes — the default stands in for a decision |
| `showFaq.status` | same triad, `initialValue: 'pending'` | yes |
| `society.*Placeholder` | booleans, `initialValue: false` | yes — **and the default asserts confirmed fact** |

Rows 2 and 3 default to the *safe* value, which is why they have worked. But a default is
still the system answering on the council's behalf, and it means "nobody has said" and "we
decided it is pending" are indistinguishable — the exact defect M1 removed. One site should
make one promise.

## What M4 actually does

**1. One shared type and one shared resolver.** `lib/data/show-pages.ts` already exports
`Provenance`, `ShowPageNotice` and `resolveNotice`. `showVisitorInfo` and `showFaq` are
migrated to consume them, mapping their existing triad:

```
'confirmed' -> 'council-supplied'
'research'  -> 'research'
'pending'   -> 'placeholder-ai'
```

The values on disk do not change; the resolver reading them does. Both document types then
render their notice through the same component as `showPage`, so the fail-loud table in
`provenance-gate.golden.md` governs all three — including its unenumerated-state rows.

**2. Remove `initialValue: 'pending'` and require the field** — on all 13
`confirmationStatuses` blocks and on `showFaq.status`. This is the change that closes the
gap, and it must happen in this order:

1. Run a migration that writes an explicit value to every currently-unset block and every
   `showFaq.status`, using `pending` where unset — the safe direction, and the value the
   default already implied.
2. *Then* tighten the schema to `Rule.required()` with no `initialValue`.

**Reversing that order breaks the secretary's Studio.** Requiring a field with no default on
a live document makes every document holding an unset block unpublishable until a human
fills it in, which would block her mid-edit on content that is not hers to decide. The
migration first makes the tightening a no-op for existing content and a real constraint for
new content. `setIfMissing` semantics, per `seeding-reconciliation.golden.md` — it writes
only where absent and can never overwrite a real value.

**3. `showPage` documents for entries 3, 16 and 17 hold the narrative, and point at the
structured blocks.** A new `showPageSection.kind` value, `visitorInfo`, names which
`showVisitorInfo` block renders at that point in the page. This is additive and uses the
reserved-kind mechanism M1 already built for `entityList` and `programme` — no M1 document
is reshaped, and no M1 assertion pins `kind`'s option list, so nothing in the running gate
breaks.

**4. `society`'s four booleans are explicitly out of scope.** They are not National Show
content, they work for what they do, and changing them reaches outside the subsection. They
are logged as a backlog item, not folded into this mission.

## What this does and does not close

**Closes** limitation (d) as stated: after M4 there is one placeholder mechanism and one
guarantee across every National Show page. A reader cannot meet a marked-placeholder page
and an unmarked-but-unconfirmed page on the same visit.

**Does not close:** `society` and any future document type that invents its own flag. The
durable fix is that `Provenance` and `resolveNotice` live in one module and are the only
supported way to express "we are not sure about this" — a convention, enforced by review,
not by the compiler.

## Verification

Extends the M4 verifier, not M1's:

| id | check |
|---|---|
| V1 | `showVisitorInfo` and `showFaq` import `Provenance` and `resolveNotice` from `lib/data/show-pages` — neither defines its own notice logic |
| V2 | no `confirmationStatuses` field and no `showFaq.status` carries an `initialValue`; each has a validation rule marking it required |
| V3 | the triad mapping is total — every one of `confirmed`, `research`, `pending`, plus null, undefined, empty string and an unrecognised value, resolves to a notice or to null exactly as the M1 fail-loud table specifies |
| V4 | the migration is idempotent and write-only-where-absent: running it twice changes nothing the second time, and it never overwrites a set value |
| V5 | /plan-your-visit, /what-to-expect and /faq still render their structured blocks — routes, accommodation, attractions, opening hours, emergency contacts, and every active FAQ — with no field lost against a pre-migration snapshot |

V5 is the one that matters. The whole argument for keeping the documents split is that the
structure is worth keeping; an assertion has to prove the structure survived.

# Golden — `council-draft`: the fourth provenance value (M4)

## The gap

`council-supplied` conflates two different properties: **whose words these are** and **whether
they are finished**. The gate suppresses the notice on the first and knows nothing about the
second.

Concrete: `17-faq.json`'s `faq` section is `council-supplied` with a resolving `sourcePath`,
so it renders with no notice — and it publishes *"The symposium will be held on xx, xx
September 22027 at the xx"*. Lee-Ann's FAQ document is an explicit working draft; her own note
in it reads *"Please keep adding to FAQ's below."* Q1's answer is an unfilled template.

**The gate did exactly what it was built to do and the result is still wrong.** We spent a day
ensuring invented copy cannot render unmarked. This is the inverse — unfinished real copy
rendering as finished — and every assertion was green on it.

The "22027" is her typo, faithfully reproduced, and correcting it is not ours to do. The
problem is not the typo. It is that an unfinished draft renders as finished copy.

## Decision: add a fourth value, `council-draft`

**Recommended, with the reasoning below rather than as an instinct.**

| value | meaning | notice? |
|---|---|---|
| `council-supplied` | the council's words, and they are finished | **no** |
| `council-draft` | **the council's words, and they are not finished** | **yes** |
| `research` | our verified research, not council-confirmed | yes |
| `placeholder-ai` | AI-generated stand-in | yes |

`sourcePath` is required for `council-draft` exactly as for `council-supplied` — it is still
council text and must still cite the document it came from.

### Why not two orthogonal fields (`provenance` × `readiness`)

That is the theoretically correct decomposition and it is the wrong shape here. Readiness only
varies **inside one provenance value**: `placeholder-ai` is never "ready", and `research` is
unconfirmed by definition. A product type would create six states of which three are
meaningless — and meaningless options in a required field the council fills in Studio invite
wrong answers rather than preventing them. A second dimension that has one value everywhere
except one place is not a dimension; it is a sub-state, and a fourth enum value expresses a
sub-state more cheaply.

### Why not just stop publishing the unfinished fragment

That is the right immediate triage and it is already done. It is a poor permanent model, for
two reasons.

It requires a human to split her document into finished and unfinished parts **on every
import**, and it fails the way the original notice problem failed: someone will forget. There
is no structural property making the safe path automatic.

And it forces a choice between two bad outcomes, because with three values there is no way to
say *"hers, unfinished"*:

- **Relabel** — move her text into a `placeholder-ai` section, which says *AI-generated* about
  words **she wrote**. A provenance lie in the opposite direction, the mirror of the defect we
  are fixing.
- **Delete** — drop her unfinished fragment and write our own placeholder in its place.
  Correctly labelled, and it discards content that had value.

**M3's triage took the second, correctly** — the unfinished fragment was removed and new
placeholder text written ("the symposium date is not yet confirmed"), which genuinely is ours.
Nothing was mislabelled. But her Q1 answer had real value as *"we know this question matters
and the answer is not settled"*, and it was lost for want of a way to say so.

That is the cost the fourth value removes: the choice disappears, because *"hers, unfinished"*
becomes expressible.

### The argument that decides it: the check becomes a classifier, not a blocker

With three values, an unfilled slot in council text is a **problem** — the gate fails and a
human must intervene.

With four, it is a **signal**. The seed classifies conservatively: council text containing an
unfilled slot is seeded `council-draft`, and renders with a notice automatically. The
assertion then pins an invariant rather than prohibiting content:

> **No `council-supplied` section contains an unfilled slot.**

The automatic path becomes the safe one, which is the same property that makes
`provenance`'s missing `initialValue` work. That is what changes this from a rule people must
remember into a shape the system enforces.

### Costs, stated plainly

- **No migration.** Adding a value to an enum does not invalidate existing documents; every
  current section already holds one of the three. The required/no-`initialValue` treatment is
  unchanged and applies to the fourth value identically.
- **A fourth radio option** for the council editor. Small, and the option's own label carries
  the distinction: *"Council draft — their words, not yet finished."*
- **A third notice wording** in `showPageSettings`: `draftLabel`, `draftNotice`, both required,
  both with the hardcoded-fallback treatment. Proposed text:
  *"This text was supplied by the South African Orchid Council and is still a working draft. It
  may be incomplete or may change before the show."*
- **Someone still has to judge** whether her text is finished. That judgement does not
  disappear — but the automatic classification is now the conservative one, so forgetting
  produces a notice rather than a silent publication.

## Visual treatment — proposed, Codi's to rule

Three notified states, **two** visual treatments. `council-draft` and `research` share the
quiet treatment (`--muted` on light, `--status-muted-on-dark` on dark); `placeholder-ai` keeps
the louder warning ink.

Rationale: both quiet states mean *"real, but not confirmed"*, while `placeholder-ai` means
*"we made this up"* — a different kind of statement, and the only one where a reader must not
rely on anything. This adds no token, needs no new contrast pair, and does not reopen R11.

N10's hierarchy rule holds unchanged: on any ground, the quiet states measure strictly below
the placeholder state. Sent to Codi as a proposal, not a decision.

## What M4 changes

| where | change |
|---|---|
| `sanity/schemas/objects/showPageSection.ts` | fourth option in `provenance`'s list; `sourcePath` conditionally required for it too |
| `lib/data/show-pages.ts` | `Provenance` type gains the value; `resolveNotice` returns the draft notice for it; the fail-loud table gains a row — **suppression still requires `council-supplied` and a resolving `sourcePath`, and nothing else** |
| `sanity/schemas/documents/showPageSettings.ts` | `draftLabel`, `draftNotice`, required, with fallback constants |
| `scripts/seed-show-pages.ts` | council text containing an unfilled slot seeds as `council-draft`; **rule 1 of `seed-write-narrowing.golden.md` extends to it** — a `council-draft` section is never written by the seed either, for the same reason: they are still her words |
| `content/show-pages/17-faq.json` | **Restore her Q1 answer as `council-draft`.** M3 deleted the unfinished fragment because there was no way to publish it honestly; F20 creates that way, so the deletion must be reversed rather than left standing. Written here explicitly because a dropped fragment stays dropped by inertia — nothing surfaces it, and the page looks finished without it. |

The M1 goldens that describe the three-value enum — `provenance-gate.golden.md`'s mechanism
section and fail-loud table, `content-model.golden.md`'s field spec — need the fourth row.
Both are frozen while M1's gate is red; they go in the same post-gate batch as the heading fix
and the non-clobber restatement.

## Assertions

| id | check | dry-run |
|---|---|---|
| CD1 | **No `council-supplied` section contains an unfilled slot** — `xx`+, `TBC`/`TBA`/`TBD`, `[ ]`/`[...]`/`[…]`, `___`, `....`, `……`. | **20/20 both directions.** Catches her actual strings: `on xx, xx September 22027 at the xx`, `www……`, `Email……`. Does not catch `From Wild Origins to Cultivated Excellence`, `R44 northbound`, `The XXI edition`, `Please keep adding to FAQ's below.`, or a single `…` in ordinary prose. |
| CD2 | `resolveNotice` returns the **draft** notice for `council-draft`, and suppression still requires `council-supplied` **and** a resolving `sourcePath` — the fourth value widens what notifies, never what suppresses. |  |
| CD3 | `council-draft` carries the same seed-write protection as `council-supplied`: never created, updated, patched or deleted by the seed, checked before any hash. |  |
| CD4 | `showPageSettings.draftLabel` / `draftNotice` are required, and the hardcoded fallbacks match this golden verbatim, so a missing settings document cannot suppress the draft notice. |  |
| CD5 | **`17-faq`'s Q1 answer is present as `council-draft`** — her words restored verbatim, `sourcePath` naming the recovered document, rendering with the draft notice. The one assertion that proves the fourth value was actually used for the case that motivated it, rather than shipped and left unexercised. |  |

**When CD1 fires, the resolution is to reclassify the section to `council-draft` — never to
edit her words to satisfy the check.** Same lever as P6's route allowlist and B6's name
allowlist, and stated here for the same reason: the next person will hit it, and editing the
client's prose is the wrong instinct that looks like the quick fix.

## The lesson, alongside the other three

The mission's running list of failure modes gains a fourth, and it is the subtlest:

1. An overstated guarantee (`GatedProse`'s escape hatch).
2. A guarantee whose implementation was weaker than its description (`sourcePath` containment).
3. A guarantee covering one field of five (`hashBody`).
4. **A guarantee correctly implemented, fully asserted, and guarding the wrong property.**

Every assertion here passed. No check could have caught it, because every check was built on
the same assumption about what `council-supplied` meant. **The defect was in the model, and
the tests inherited it.** That is the argument for having someone outside the chain read the
output — the M3 Codex pass found this, exactly as the M1 pass found the `hashBody` defect.

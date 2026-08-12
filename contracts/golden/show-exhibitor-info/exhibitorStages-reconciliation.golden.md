# F4 — reconciling `nationalShow.exhibitorStages`

## The problem, precisely

`sanity/schemas/documents/nationalShow.ts:13` declares:

```ts
defineField({ name: 'exhibitorStages', title: 'Exhibitor Stages', type: 'portableText' }),
```

It is projected by `nationalShowQuery` and rendered on `app/(marketing)/national-show/page.tsx`
around line 375, with a hardcoded `EXHIBITOR_STAGES` constant (declared at line 55) as the
fallback when the Sanity field is empty.

Once `showExhibitorStep` exists, **the same information has two homes**: an unstructured
portable-text blob on the show record, and an ordered set of typed step documents. An editor
updating one will not know the other exists. That is the drift the mission's F4 exists to stop —
and, per research §10, that blob is the entire reason the schema gap was total in the first place:
*"An editor today can only paste one undifferentiated block of text into `exhibitorStages`."*

## The decision: RETIRE it. `showExhibitorStep` is the single source.

Not "use it". Retire it. The reasoning:

- The new type does everything the old field does and the things it structurally cannot —
  per-step ordering, per-step confirmation status, per-step retirement via `active`.
- Keeping both and picking one at render time (`exhibitorStages ?? steps`) is the worst option:
  it makes the winner depend on whether a field happens to be empty, which is invisible in the
  Studio and produces exactly the kind of "I edited it and nothing changed" bug this project has
  already hit.
- The field has no other consumer. Nothing but the landing page reads it.

## Retirement in three steps, only two of which this contract can execute

### Step 1 — in scope, asserted here

**The new page never reads `exhibitorStages`.** No import, no query projection, no fallback. The
exhibitor guide is built exclusively from `showExhibitorInfo` and `showExhibitorStep`, so from the
moment it ships there is exactly one source *for this page*.

Asserted structurally (`exhibitorStages` appears nowhere under
`app/(marketing)/national-show/exhibitors/` or in the new queries) and at the rendered level
(the seeded step titles appear on the page, proving the steps are what drives it).

### Step 2 — in scope, asserted here

**The seed never writes `exhibitorStages`.** A seed script that populated the field it is meant
to be retiring would entrench it. Asserted by grep against the seed script.

### Step 3 — GATED FOLLOW-UP, cannot be executed by this contract

Deleting the field requires editing two files reserved by the visitor stream, which is modifying
both of them right now:

- `sanity/schemas/documents/nationalShow.ts` — remove the `exhibitorStages` field
- `app/(marketing)/national-show/page.tsx` — remove the render block and the `EXHIBITOR_STAGES`
  constant, replacing that section with a link to `/national-show/exhibitors`

There is a second, harder blocker beyond file ownership: the sibling contract's **A5 explicitly
asserts that `exhibitorStages` still exists** —

```
A5: F1 - no pre-existing nationalShow field was removed while adding venue
    for f in title showDate location hero countdownDate exhibitorStages salesOpen; ...
```

Removing the field while that contract is open would turn its gate red. The two contracts would
be asserting opposite things about the same line of the same file. That is not a merge conflict
that resolves itself.

**Therefore step 3 is booked, not attempted.** Attempting it would break a sibling stream's gate
and lose a merge race. This is reported to the orchestrator rather than worked around.

## Booked follow-ups

| ID | Work | Gated on | Files |
|---|---|---|---|
| **FU-1** | Landing page links to `/national-show/exhibitors`, replacing the inline exhibitor-stages section | show-visitor-info landing-page work landing | `app/(marketing)/national-show/page.tsx` |
| **FU-2** | Delete `exhibitorStages` from the schema, its query projection, and the `EXHIBITOR_STAGES` constant | FU-1, **and** the sibling contract's A5 being amended to drop `exhibitorStages` from its field list | `sanity/schemas/documents/nationalShow.ts`, `sanity/queries.ts`, `app/(marketing)/national-show/page.tsx`, `contracts/contract-show-visitor-info.yaml` |
| **FU-3** | Unify `ExhibitorStatusBadge` and the visitor stream's `ConfirmationBadge` into one component with a four-value list | both streams landed | `components/show/` |

These go to `.agent/memory/project/needs-human.md` — not because they need a human decision, but
because they need a **sequencing** decision only the orchestrator can make, and an undocumented
follow-up is an abandoned one.

## Interim state, stated plainly

Between this mission landing and FU-2, `nationalShow.exhibitorStages` still exists in the schema
and still renders on the landing page. There will be a window in which the landing page shows the
old blob and `/national-show/exhibitors` shows the new structured guide. That window is
**visible, bounded and booked** — which is the difference between a known interim state and the
"two overlapping sources" the mission forbids. What the mission forbids is leaving it
*undocumented and unowned*, and it is neither.

To keep the window honest, the contract asserts one thing about it: the seeded step content and
the hardcoded `EXHIBITOR_STAGES` constant must not contradict each other on any date, time or
fee — trivially satisfied, because the new content states no dates, times or fees at all.

---

## Round 2 addendum (2026-08-12) — the interim window is now guarded, not merely documented

@qa's F-7 accepted the reasoning above and still called F4 unmet, correctly: "booked" is a promise,
not a guard. The failure scenario it named is a human one — a committee member opens the National
Show document in Studio, sees an inviting empty **Exhibitor Stages** box, and fills it in. Nothing
in the plan above would have caught that. The landing page would simply start publishing a second
exhibitor journey, and neither editor would have any way of knowing the other existed.

FU-2 is still blocked for exactly the reasons stated above — re-verified on 2026-08-12,
`contract-show-visitor-info.yaml:131` still requires the field to exist — so the field cannot be
deleted. But **retirement is a state of the data, not only of the schema**, and the state that
actually matters is assertable today without touching a single reserved file.

**A51** (`contracts/checks/show-exhibitor-info/check-exhibitor-stages-retired.mjs`) asserts:

1. No `nationalShow` document has `exhibitorStages` defined. Green today; red the instant anyone
   publishes through the old field, with instructions pointing at Studio → Exhibitor Steps.
2. The rendered `/national-show` does not restate any active step title from the guide. This is a
   separate reading of the same claim, and it is the one that catches the *hardcoded* second
   source: `EXHIBITOR_STAGES` in `page.tsx` would satisfy (1) forever, because it is not in the
   dataset at all.

Neither check writes anything. `nationalShow` remains owned for mutation by
`contracts/checks/cms-loop-f3-national-show`.

The interim window described above is unchanged in length. What changed is that it can no longer
widen silently: the two-source failure this mission forbids now trips a gate on the day it happens
instead of being discovered later by a reader who believed the wrong journey.

---

## STATUS UPDATE 2026-08-12 — FU-2 is unblocked and landing

The gate described below has been lifted by team-lead ruling. For the next reader, so this
document is not read as still-blocked:

- `contract-show-visitor-info.yaml` **A5** no longer lists `exhibitorStages`. It guards against
  *collateral* deletion during F1; a deliberate retirement is the opposite of what it protects
  against, and a grep cannot tell the two apart.
- That contract gained **A77**, which asserts the retirement is COMPLETE — the field absent from
  the schema, the GROQ projection AND the landing page's read path. FU-2 can no longer be
  half-done and pass.
- The deadlock had a **third side** not recorded below: `cms-loop-f3-national-show.yaml` **A3**
  round-tripped a sentinel through `exhibitorStages` and asserted it rendered. Its subject was the
  field itself, so it was permanently unsatisfiable once the read path went. Retired in the same
  change, with the reasoning recorded in that contract.
- Precondition re-verified before any deletion: `count(*[defined(exhibitorStages)]) == 0` across
  every document type. No editorial content was destroyed.

FU-1 (link the exhibitor guide from the landing page) and FU-3 (unify the two badge components)
are unaffected by this update.

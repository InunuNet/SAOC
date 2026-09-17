# Golden — the seed may never overwrite a council-authored field (M4)

## Why this golden exists

M1's gate FAILED on A39 — the cross-model review assertion — with a finding that invalidates
`seeding-reconciliation.golden.md`'s central promise:

> `scripts/seed-show-pages.ts:246` — `hashBody` hashes only `body`, but line 254 replaces the
> **whole section**. An editor who changes a `heading`, or flips `provenance` to
> `council-supplied` after writing real copy, hashes identical, classifies as `update`, and is
> **silently overwritten**.

Those are the two most likely things Lee-Ann will ever do. The guarantee was stated as "a
re-run can never overwrite an edit"; what shipped protected one field of five.

**This is the third overstated guarantee on this mission** — after the `GatedProse` escape
hatch and `sourcePath` containment. All three had working-looking implementations and golden
text describing a stronger property than the code delivered. M1's fix narrows the write; **M4
pins that narrowing, or it regresses the first time someone refactors the seed.**

## The four rules

### Rule 1 — a `council-supplied` section is never written. At all.

If `provenance` is `council-supplied` in the dataset, the seed does not create, update, patch
or delete that section, **regardless of any hash**. That value is the council declaring the
words are theirs. Nothing we generate has standing to overwrite it.

Total, unconditional, and it needs no hash to be correct — which is the point. It covers the
likeliest real case directly: Lee-Ann replaces our placeholder with her copy, flips the flag,
and the next seed run leaves it alone whatever else has changed.

### Rule 2 — `seedHash` covers every field the seed writes, not just `body`

Seed-owned fields on a section: **`heading`, `body`, `provenance`, `sourcePath`**. The hash is
computed over all four, canonicalised. A change to any one of them is an edit and classifies
`skip-edited`.

`sectionKey` is excluded because it is the identity the reconciliation keys on, not content.
`seedHash` itself is excluded — hashing a value into itself is not defined.

### Rule 3 — the write is field-scoped, never a whole-section replace

The seed patches only its own four fields. It never assigns a replacement section object.

Two reasons. A whole-object write silently deletes any field an editor or a later schema
version added — the defect above, in its general form. And a field-scoped patch makes the
blast radius of a seed bug proportional to the fields it owns, rather than to the whole
document.

### Rule 4 — the read/commit race is closed with optimistic concurrency

M1's gate also found:

> `seed-show-pages.ts:270` — read/commit race; an edit saved between `getDocument()` and the
> unconditional commit is clobbered.

The hash check is meaningless if the document can change between the read that produced it and
the write that acts on it. The patch carries the revision id observed at read time
(`ifRevisionId`), so a save landing in that window makes the commit **fail** rather than
overwrite. A failed commit is reported and the section is skipped — a retry re-reads and
re-decides.

Without this, Rules 1-3 are correct and still lose the race.

## The decision table, restated

Supersedes the six-row table in `seeding-reconciliation.golden.md`. `decideSectionAction`
stays pure and exported; it gains the current section's `provenance` and full seed-owned field
set as inputs.

| dataset state | action |
|---|---|
| section's `provenance` is `council-supplied` | **`skip-council`** — never written, no hash consulted |
| section absent | `create` |
| present, `seedHash` matches a fresh hash of its four seed-owned fields | `update` — field-scoped patch, guarded by `ifRevisionId` |
| present, `seedHash` does not match | `skip-edited` |
| present, no `seedHash` | `skip-unknown-origin` |
| in the dataset, absent from the seed source | `leave-extra` |

`skip-council` is checked **first**, before any hash comparison. Ordering is part of the rule:
a council-supplied section with a stale hash must skip because it is council-supplied, not
because the hash happened to differ.

## What M4 asserts

| id | check |
|---|---|
| SW1 | `decideSectionAction` returns `skip-council` for every `council-supplied` input — including one whose `seedHash` matches perfectly, which is the case a hash-first implementation gets wrong |
| SW2 | `hashBody` (or its successor) covers `heading`, `body`, `provenance` and `sourcePath`: changing **each field individually** changes the hash. Four sub-cases, not one — a hash covering three of four passes a single-field test |
| SW3 | The seed issues no whole-section replace: the write path contains no assignment of a complete section object, and a section carrying an extra unknown field retains it after a simulated `update` |
| SW4 | Every seed patch carries `ifRevisionId`; a commit whose revision has moved fails and is reported, never applied |
| SW5 | Driven end-to-end against a fixture dataset: a section edited in each of the four seed-owned fields, and one flipped to `council-supplied`, all survive a re-run byte-identical |

SW5 is the one that matters. SW1-SW4 check the mechanism; SW5 checks the property the council
actually cares about — **their words are still there after we run the script again.**

## What this still does not prevent

- **A seed bug outside `decideSectionAction`.** The decision is pure and tested; the I/O half
  that acts on it is not pure and is tested only by SW5's fixture run.
- **A schema change that renames a seed-owned field.** The hash would then cover a field that
  no longer exists and miss its replacement. Nothing here detects that; only SW2 failing after
  a rename would, and only if someone re-runs it.
- **Anything about Studio's own history.** If the seed does overwrite something, Sanity's
  document history is the recovery path, not this golden. Worth knowing before a first live
  run against real content.

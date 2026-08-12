# show-exhibitor-info — golden files

Contract: `contracts/contract-show-exhibitor-info.yaml`
Mission: `.agent/memory/project/missions/2026-08-11-show-exhibitor-info.md`
Research source: `.agent/memory/project/show-exhibitor-conventions.md` (@analyst / EXH-RESEARCH, 2026-08-11)
Sibling contract whose conventions this one follows: `contracts/contract-show-visitor-info.yaml`

## The one rule that outranks every other rule here

**Never state a rule as SAOC policy that SAOC has not confirmed.**

An exhibitor who drives from Gauteng to Cape Town with a bench of Cymbidiums and is turned away
at staging because this website invented a deadline has been harmed by us. Not inconvenienced —
harmed. Every other decision in these goldens is downstream of avoiding that.

The seeded content is **researched international convention, offered as a starting point for the
show committee to correct**. It is not SAOC policy, it must never read as SAOC policy, and the
contract asserts that at the rendered-HTML level, not just in prose.

## Files

| File | What it settles |
|------|-----------------|
| `exhibitor-confirmation-model.golden.md` | The four-value status model and why this stream needs a fourth value the visitor stream did not |
| `showExhibitorInfo-schema.golden.json` | The singleton: sections, key dates, entry form, open questions, confirmations |
| `showExhibitorStep-schema.golden.json` | The repeatable journey-step document type |
| `research-to-copy-map.golden.md` | Every seeded block traced to the research finding behind it, with its status. The audit trail for "why does the page say this?" |
| `exhibitor-page-map.golden.md` | Route, reachability edges, cross-links, and what must NOT be duplicated |
| `exhibitorStages-reconciliation.golden.md` | F4: how `nationalShow.exhibitorStages` is retired, and why the final step is gated |
| `seed-show-exhibitor-info.golden.json` | The exact seed payload |

## Conventions inherited from show-visitor-info (do not reinvent)

1. A `confirmations` object on the singleton covering every fixed content block, defaulting to
   `pending`, so an unset status can never read as confirmed.
2. Array items and collection documents carry their **own** `status` field instead — a per-item
   status is the only shape that lets the committee confirm one line at a time.
3. Pinned singleton in `sanity/structure.ts` for the singleton; listed collection for the
   repeatable type.
4. A **new** seed script. `scripts/seed-page-singletons.ts` is never extended — it has a
   `createOrReplace` bug that silently reverts editor changes on every run.
5. `createIfNotExists` / `setIfMissing` only. No seeded field is an empty string. Portable-text
   `_key`s are deterministic, never random, or the seed is not idempotent.
6. Rendered-level proof: a live dataset write must provably reach the rendered page
   (the sibling's A41/A42 venue-change test). Here that is the **deadline-change test**.
7. Greps settle only structural facts and are labelled `STRUCTURAL` in the contract. Every claim
   of the form "the page shows X" is a real HTTP round trip against `http://localhost:3333`.

## Deliberate divergences from the sibling, each with a reason

| Divergence | Reason |
|-----------|--------|
| Four status values (`pending` / `research` / `question` / `confirmed`) not three | The research has a whole category — Section 12, "things this research could NOT establish" — that is neither an invented placeholder nor a verified fact. See `exhibitor-confirmation-model.golden.md`. |
| A separate `exhibitorConfirmationStatuses.ts` object rather than reusing `confirmationStatuses.ts` | That file is being written by the visitor stream right now, and its thirteen block names are visitor-specific. Sharing it would mean editing an in-flight file to add exhibitor blocks it should not carry. |
| A separate `ExhibitorStatusBadge` rather than reusing `ConfirmationBadge` | Same reason. This is real duplication and is booked as a follow-up in `exhibitorStages-reconciliation.golden.md`, not pretended away. |

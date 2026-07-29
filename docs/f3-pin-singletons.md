# F3 — Pin Page Singletons in Sanity Studio

**Mission:** `cms-activation-deploy`, feature F3. **Status:** implemented, @qa PASS
(all five contract assertions green, 2026-07-29). Builds on the gap identified in
[`docs/f6-page-singletons.md`](./f6-page-singletons.md) §1/§5 step 1: Studio exposed
the six page-singleton types as ordinary lists with no protection against an editor
creating a second document of the same type.

## What changed

Two files:

- **`sanity/structure.ts`** (new) — exports `structure(S, context)` and
  `filterNewDocumentOptions(options, context)`.
- **`sanity.config.ts`** — wires `structure` into `structureTool({ structure })` and
  `filterNewDocumentOptions` into `document: { newDocumentOptions: filterNewDocumentOptions }`.

### The six pinned types

`homePage`, `aboutPage`, `nationalShow`, `contactPage`, `judgingPage`, `membersPage`.

Each is pinned to a single, fixed document ID equal to its own schema type name
(`homePage` → `_id: "homePage"`, etc.) — this is Sanity's own documented singleton
convention; a draft edit becomes `drafts.homePage`. In the Studio sidebar each type now
opens directly into that one document (`S.document().schemaType(t).documentId(t)`)
instead of showing a list with a "+ Create new" button.

`membersPage` is pinned identically to the other five, per Brad's decision on
2026-07-29, even though the Members page itself is not built yet (see "membersPage
placeholder" below) — it stays an empty, protected placeholder rather than an
unprotected orphan schema.

The nine ordinary collection types — `society`, `boardMember`, `societyEvent`, `show`,
`showClass`, `award`, `sponsor`, `judge`, `province` — are untouched: they still render
as standard creatable lists (`S.documentTypeListItem`), confirmed still creatable by
@qa after the change.

### Two layers of protection

1. **Desk sidebar** (`structure`): each pinned type's sidebar entry opens the one fixed
   document directly — there's no list view and no "+ Create new" button visible from
   that entry.
2. **Global "create new" menu filter** (`filterNewDocumentOptions`): Sanity Studio also
   has a menu (usually a "+" in the top nav) that lists every creatable type across the
   whole schema, independent of the desk sidebar. Without closing this too, an editor
   could still create a second `homePage` etc. through that menu even though the
   sidebar only ever opens the fixed one. `filterNewDocumentOptions` removes the six
   pinned types from that list; ordinary collection types are left alone.

### Why this matters

Every front-end query for these six types uses the pattern
`*[_type == "X"][0]` (see `sanity/queries.ts` — `homePageQuery`, `aboutPageQuery`,
`nationalShowQuery`, `contactPageQuery`, `judgingPageQuery`; no `membersPageQuery`
exists, see below). `[0]` takes the first result from an **unordered** GROQ set. If a
second document of one of these types existed, the site would silently start rendering
whichever one Sanity happened to return first — no error, no warning, and no way to
tell from the rendered page which document is live. F3 makes that duplicate
impossible to create *from the Studio UI*, which is the only way editors normally
create content.

## What F3 does *not* guarantee — read before relying on this

**F3 protects the Studio UI, not the write API.** @qa demonstrated this directly:
calling `client.create({ _id: 'qa-f3-duplicate-test-homePage', _type: 'homePage' })`
against the live dataset with a write-token client succeeded with zero resistance —
Sanity's desk structure and the "create new" menu filter are both Studio-layer UI
concerns; they do not add a database-level uniqueness constraint. (The test document
was deleted immediately after and per-type counts were verified back to their
pre-test values.)

This is consistent with the contract's stated scope (`contracts/f3-pin-singletons.yaml`
— a desk-structure mechanism, not a data-layer constraint) but it means: **`[0]` is
only deterministic so long as no out-of-band duplicate exists.** If a future script,
migration, or integration ever holds a Sanity write token and calls `client.create()`
(or the HTTP mutate API directly) with one of these six `_type`s and a different `_id`,
it can still create a duplicate, and the `[0]`-query fragility this feature exists to
close would reopen silently. There is currently no such integration in this codebase —
flagged in the backlog below as informational, to revisit only if one is ever added.

## membersPage placeholder

No `membersPageQuery` exists in `sanity/queries.ts` and no route consumes it — this is
intentional, not a gap in F3. Per the project spec
(`documents/Website Development SpecificationV1.docx` §3.5), the real Members Portal is
a separate, authenticated, member-only area with a Digital Journal library — a distinct
future build, not this singleton. `membersPage` is pinned now purely so that if/when
that decision is made, the placeholder document slot is already protected against
duplication; it carries no content and nothing renders from it today.

## Verification

All five contract assertions (`contracts/f3-pin-singletons.yaml`) pass:

- **A1** — each of the six pinned types resolves, via the real `structure(S, context)`
  function, to a fixed document pane (not a list/create-new resolver).
- **A2** — `filterNewDocumentOptions`, called with synthetic input, removes exactly the
  six pinned types and leaves ordinary collection types untouched.
- **A3** — live-dataset check: every pinned type has 0 or 1 documents (no pre-existing
  duplicates to reconcile).
- **A4** — `pnpm type-check` passes with the new file and config wiring.
- **A5** — the port-3333 dev server Brad was using is still up and `/studio` returns
  200 after the change.

@qa independently negative-controlled A1 and A2 by removing `sanity/structure.ts` and
stashing the `sanity.config.ts` change — both checks failed genuinely against that
reverted state, and both files were then restored byte-identical. `/studio` was
confirmed to return 200 *and* serve the real Studio shell, not a 200-ing error page.
All nine ordinary collection types were confirmed still creatable. The six pinned IDs
match what `sanity/queries.ts`'s GROQ queries actually fetch (`homePage`, `aboutPage`,
`nationalShow`, `contactPage`, `judgingPage`, plus the unwired `membersPage`
placeholder).

A Studio login wall (OAuth, no stored session for agents — same wall as `needs-human.md`
item RF-11) means A1/A2 verify the actual runtime code path the Studio calls (not a
source-text grep) but stop short of a rendered-pixel screenshot. That level of
confirmation is logged to `.agent/memory/project/needs-human.md`, not gating this
contract.

## Known check weakness (backlog item, not a current false pass)

`contracts/checks/f3-pin-singletons/check-new-document-filter.mjs:17` hardcodes:

```js
const MUST_SURVIVE = ['society', 'event'];
```

`'event'` is not a real schema type name. `sanity/schemas/index.ts` imports a binding
named `event` from `sanity/schemas/documents/event.ts`, but that file's own
`defineType` declares `name: 'societyEvent'` (`sanity/schemas/documents/event.ts:4`) —
the import binding and the schema's actual `_type` string diverge.

This causes **no false pass today**: A2 only tests set membership against the six
pinned-type strings, and `'event'` never collides with any of them either way, so the
assertion's pass/fail outcome is unaffected. But it does mean A2 never actually
exercises the real `societyEvent` name. If a future change to
`filterNewDocumentOptions` accidentally filtered `societyEvent` out of the create menu
(a real regression an editor would hit), A2 would not catch it, because it's checking
survival of a string (`'event'`) that no schema uses. Flagged for an @architect
follow-up to fix the constant; not a blocker on F3 itself.

## Related docs

- [`docs/f6-page-singletons.md`](./f6-page-singletons.md) — the assessment that
  identified this gap (§1, §5 step 1) plus the wider singleton picture (seeding,
  `hostSociety`, dead fields) that F3 does not address.
- [`contracts/f3-pin-singletons.yaml`](../contracts/f3-pin-singletons.yaml) — full
  scope, negative-control evidence, and assertion definitions.

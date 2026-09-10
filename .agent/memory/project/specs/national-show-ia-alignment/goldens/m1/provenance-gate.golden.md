# Golden — the provenance gate (M1, pinned semantics)

This is the golden Brad's hard condition rests on. Everything else in M1 is plumbing.

**Requirement, in Brad's words:** researched placeholder copy is allowed on the pages the
council has not written, on one condition — it must be unmistakably marked as placeholder,
AI-generated, awaiting proper copy from the Orchid Council. *"It must be structurally
impossible for placeholder copy to render without that notice."*

## Why the project's existing placeholder pattern is not good enough

`sanity/schemas/documents/society.ts:19-58` already carries four placeholder flags —
`foundedPlaceholder`, `memberCountPlaceholder`, `meetPlaceholder`, `venuePlaceholder`.
Every one is `type: 'boolean'` with `initialValue: false`.

That shape fails the requirement in three distinct ways, and each failure is silent:

1. **The safe-looking default is the dangerous one.** `false` means "this is confirmed
   fact." A document created by any route that does not deliberately set the flag —
   Studio's "create new", an import, a future migration script, a dev's fixture — asserts
   confirmed fact about content nobody confirmed. The system's default answer to "is this
   real?" is "yes."
2. **Absence is indistinguishable from a decision.** A missing boolean and an explicit
   `false` read identically downstream. There is no state that means "nobody has said."
3. **It is per-field, so it does not scale to prose.** Four flags cover four scalar
   fields. A page of portable text has no such enumerable surface.

M1 does not change `society` — that is out of scope and those four flags work for what
they do. But `showPage` must not repeat the shape.

## The mechanism

**Field:** `showPageSection.provenance`
**Type:** `string`, rendered as a radio list
**Validation:** `Rule.required()`
**initialValue:** **none — deliberately absent.** This is the single most important line in
the schema. With no initial value, Sanity's required-field validation blocks publication
until an editor makes an explicit, conscious choice. There is no state in which the system
guesses on the council's behalf.

**Values — exactly three, no more:**

| value | meaning | who may set it |
|---|---|---|
| `council-supplied` | The words came from a document the Orchid Council wrote. `sourcePath` must name that document and it must exist on disk. | seed script (with a verified source), or the council in Studio after replacing the copy |
| `research` | Verified by the web team from a real external source, but never confirmed by the council. | seed script, or the web team |
| `placeholder-ai` | AI-generated stand-in copy. Nobody has confirmed any of it. | seed script |

Three values, not a boolean, because the honest answer has three states and the project
already learned this: `sanity/schemas/objects/confirmationStatuses.ts:14-18` uses exactly
this pending / research / confirmed triad for visitor info, and its own comment records
why — *"Every block defaults to 'pending'. That default is the whole safety property — an
unset status can never read as committee-confirmed fact."* M1 keeps the triad and tightens
it further: no default at all, so an unset status cannot even be published.

## The render obligation — what each layer actually guarantees

A notice a page author has to remember is a notice that will eventually be forgotten. So the
copy and the notice are bound together at the module boundary rather than assembled by each
page.

**The guarantee, stated exactly:** *accidental misuse does not compile; deliberate misuse
fails CI.* It is **not** "structurally impossible", and this file said that it was. See the
correction below — the overstatement is the part worth reading.

`loadShowPage(pageKey)` returns a `ShowPage` whose sections expose `body` only as an opaque
`GatedProse` — a branded type carrying the portable-text blocks alongside the section's
resolved notice. Three layers then stand between that value and an un-noticed render, and
they stop different things:

| layer | what it stops | strength |
|---|---|---|
| **The brand.** `GatedProse` is structurally incompatible with `PortableTextBlock[]`. | The naive mistake: passing `section.body` straight to `PortableText`. | **Compile error.** The strongest of the three, and it holds — QA confirmed it with a `@ts-expect-error` fixture that the compiler accepted. |
| **Renderer-private unwrap.** The function that opens `GatedProse` is not exported from `lib/data/show-pages.ts`; it lives in a module only `ShowPageProse` may import. | A second component reaching for the unwrap by import. | **Compile error** for anything outside the renderer's module graph. |
| **ESLint `no-restricted-imports` + assertion A47.** | A deliberate import of the private module from anywhere else. | **CI failure.** A lint rule and a grep, not a type — a determined author can still write it, and it will go red rather than being impossible. |

**`components/nos/ShowPageProse.tsx` remains the only renderer of `GatedProse`.** It emits
the notice element and then the blocks in the same return statement. There is no prop that
suppresses the notice and no code path that reaches the blocks without having emitted it,
because the two are one JSX expression. That part was always true and is unaffected.

### The correction, and why it is recorded rather than quietly fixed

This section previously read: *"the copy never crosses a module boundary as plain data, so
there is no un-noticed form of it to render by mistake. A page author does not choose to
include the notice; they have no way to exclude it."*

**That was false as shipped.** `lib/data/show-pages.ts` exported
`__unsafeUnwrapGatedProse` as an ordinary public symbol, guarded only by the doc-comment
above it. @qa wrote a probe that imports it from an arbitrary component, discards `notice`,
and renders the blocks through `PortableText` — it typechecked clean, exit 0, against the
real project types (`.tmp/sandbox/nos-ia/qa-bypass-attempt.tsx`). The naming convention was
the whole enforcement.

Worse than the hole: the escape hatch was **absent from this file's own limitations list**,
which enumerated editor mislabelling, the GROQ grep, accuracy, non-`showPage` content and
visual noticeability — everything except the mechanism that most directly defeated the
central claim.

**Two of the three critical findings on M1 were overstated guarantees, not missing code** —
this one and the `sourcePath` containment case. Both had working-looking implementations and
both had golden text describing a stronger property than the code delivered. That is the
failure mode to watch on this mission: not an absent check, but a check described as more
than it is, which stops the next person looking. A limitation that reads as stronger than it
is does more damage than no limitation at all.

## Fail-loud table — every unenumerated state notifies

Mirrors the house style in `lib/admin-auth.ts` (fails closed on every unenumerated state).
`resolveNotice()` in `lib/data/show-pages.ts` implements this table exactly, and its
`switch` has an explicit `default` branch — never a fallthrough to `null`.

| section state | notice rendered? | which notice |
|---|---|---|
| `provenance === 'council-supplied'` and `sourcePath` names a file that exists | **no** | — |
| `provenance === 'council-supplied'` but `sourcePath` is absent or empty | **yes** | placeholder |
| `provenance === 'research'` | **yes** | research |
| `provenance === 'placeholder-ai'` | **yes** | placeholder |
| `provenance` is `null` / `undefined` / empty string | **yes** | placeholder |
| `provenance` holds an unrecognised string (legacy doc, typo, future value) | **yes** | placeholder |
| `showPageSettings` singleton missing, or its label fields blank | **yes** | placeholder, using the hardcoded fallback constants |
| section `kind` is `entityList` or `programme` (M2 values, no prose) | **yes** | placeholder — an unimplemented section type has no confirmed content |

The single rule behind every row: **the notice is suppressed only by an affirmative,
verified `council-supplied`. Every other state, known or unknown, notifies.** Silence is
never a default and never a fallback.

## Page-level rollup

`loadShowPage()` also computes `pageProvenance`, which is **derived and never stored** —
a stored rollup can drift out of sync with the sections it summarises.

```
pageProvenance = 'council-supplied'   only when sections is non-empty
                                      AND every section resolves to no notice
pageProvenance = 'research'           when no section is placeholder and at least one
                                      section is research
pageProvenance = 'placeholder-ai'     in every other case, including a page with zero
                                      sections
```

A page with no sections rolls up to `placeholder-ai`, not to clean. An empty page is not
council-supplied content; it is content nobody has written.

Every page template renders one page-level notice from `pageProvenance` near the top of the
page (so a visitor sees it before reading anything), and `ShowPageProse` renders the
per-section notice inline (so it stays attached to the specific block when Lee-Ann clears
one at a time). Both, not either — the page-level one is for the visitor arriving; the
section-level one is for the editor working.

The notice's *visual* treatment is a design question and goes to `saoc-nos-design-cc` — see
`codi-handover.golden.md`. Nothing in this gate proves the notice is **noticeable**, only
that it is present and precedes the copy in the DOM.

## What this design does NOT prevent — stated plainly

The gate is strong at the boundaries it owns. These are the gaps, and they are real:

1. **An editor can lie — but the cost is now real, and it was not before.** Nothing stops
   someone opening a placeholder section in Studio, setting `provenance` to
   `council-supplied`, and leaving the AI copy in place. To do it they must also supply a
   `sourcePath` that is repo-relative, free of `..` segments, prefixed with
   `content/drive-source/` or `content/drive-recovered/`, and whose **resolved** path stays
   inside that root and names a file that exists. In practice that means naming a real
   council document — the lie has to be told against a specific file somebody can open.

   **This paragraph previously overstated the guarantee, and the correction is worth
   recording.** The first implementation resolved `sourcePath` against the working directory
   and called `existsSync`, so **any** existing path on the machine satisfied it —
   `/etc/hosts`, or a `../../..` traversal — and the schema only required a non-empty
   string. The stated cost was zero. Codex GPT-5.5 found it (`lib/data/show-pages.ts:111`).
   A limitation that reads "hard but possible" when it is actually trivial is worse than no
   limitation at all, because it stops anyone looking.

   **Mitigations, and their edges:** assertion A45 / driver check G11 pins containment in
   both directions — the rejections are tested, not just the acceptance, because a
   one-directional check here would recreate exactly this defect. A28 verifies every
   `council-supplied` section in the committed seed corpus against a file on disk. Neither
   covers a later Studio edit, and neither can tell whether the named document actually
   contains the words in the section. Naming the wrong real file still passes.
2. **A future developer can bypass the module.** Nothing stops someone writing a new GROQ
   query against `showPage` directly and rendering `sections[].body` without going through
   `loadShowPage`. Assertion A8 greps for exactly this and fails the gate — but a grep is a
   CI guard, not a type-system guarantee, and a sufficiently different query shape evades
   it.
3. **It says nothing about accuracy.** `council-supplied` means "the council wrote these
   words," not "these words are true." Lee-Ann's own FAQ source contains "22027" and
   "xx, xx September" — council-supplied and wrong.
4. **It does not cover content outside `showPage`.** `showVisitorInfo`, `society`,
   `nationalShow` and `ticketType` keep their own placeholder conventions. A visitor
   reading /plan-your-visit is protected by `confirmationStatuses`, not by this gate. M1
   does not unify them, and until something does, the site has two placeholder mechanisms
   with different guarantees.
5. **The renderer boundary is CI-enforced, not type-enforced, at its last layer.** The brand
   and the renderer-private module make accidental misuse a compile error. A developer who
   deliberately imports the private unwrap module from another component defeats both, and
   is caught by an ESLint `no-restricted-imports` rule and assertion A47 — a CI failure, not
   an impossibility. `.tmp/sandbox/nos-ia/qa-bypass-attempt.tsx` is kept as the fixture that
   check is proved against: **a boundary check nobody has watched fail is not a boundary
   check.** Nothing prevents a future author from adding a second export that reopens the
   same hole; only review and the lint rule's scope do.

6. **The notice is visual.** A screen-reader user gets it because it is real text in the
   DOM before the copy, not a decorative badge — but nothing in M1 verifies the announced
   order, and no assertion here measures contrast or focus. That belongs with Codi.

## Fixed wording (seed defaults for `showPageSettings`)

The council can reword these in Studio. These are what the seed writes, and what the
hardcoded fallback constants in `lib/data/show-pages.ts` must match verbatim.

- `placeholderLabel`: `Placeholder copy`
- `placeholderNotice`: `This text is an AI-generated placeholder. It has not been written or approved by the South African Orchid Council, and it may be inaccurate. Final copy is still to be supplied by the Council.`
- `researchLabel`: `Not yet confirmed`
- `researchNotice`: `This information was researched by the web team and has not yet been confirmed by the South African Orchid Council.`

The placeholder wording names all three things Brad required — that it is a placeholder,
that it is AI-generated, and that the Council still owes the real copy.

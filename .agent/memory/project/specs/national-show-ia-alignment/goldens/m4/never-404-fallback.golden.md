# Golden — the never-404 fallback, and the three states it must keep distinguishable

**Brad, 2026-09-10:** *"build all pages needed don't get blocked by the design just do a best
effort approach that better than a 404 from the menu link"*

A route listed in the menu must never answer a click with a 404 because a CMS document is
absent. This golden specifies the resilience layer that guarantees it, **and the machinery that
stops that guarantee from becoming this repo's audited defect class.**

---

## 0. The trap this golden exists to defeat

Once a page cannot 404, *"the route returns 200"* is **trivially satisfiable** — true forever,
whether or not a word of content exists. That is precisely the defect this mission has already
hit five times: an assertion satisfiable by something that is not the property it claims to
prove.

So the layer is only acceptable if these three outcomes stay **separable by machine**, and no
assertion is permitted to conflate them:

| state | meaning | machine signature |
|---|---|---|
| **1 — published** | the `showPage` document was found; its real sections rendered | exactly one `data-nos-content-state="published"` element |
| **2 — fallback** | the link works, the content is genuinely absent | exactly one `data-nos-content-state="fallback-unpublished"` element |
| **3 — anything else** | still a failure | non-200, no marker, two markers, or an unknown marker value |

**State 2 is a working link, not a working page.**

### The gate condition is DISCLOSURE, not content presence

*(Lead's ruling, 2026-09-10 — this supersedes an earlier draft of this golden that gated on
`published == 6`.)*

- **PASS** on a disclosed fallback.
- **FAIL** on an undisclosed fallback.

The failure condition is **not** *"this page is a shell"* — it is *"this page is a shell and
does not say so."*

Two things follow, and both matter:

**Content presence is not ours to require.** The Council supplies copy on its own schedule. A
gate that fails until they do would go red for months on a property nobody in this repo
controls, and a permanently-red gate is a gate everyone learns to skip. Honest disclosure *is*
ours to require, absolutely, and it is the property that actually protects the reader.

**A reported number that nothing gates on is not a safeguard.** That is precisely how the
skip-as-pass defect landed this afternoon. So the census is not merely printed — `NF3` gates on
the census **being complete and having run**, on every route, on every run. A metric that
appears only when non-zero is indistinguishable from a metric that is not running, so the
fallback count is emitted whether it is 0 or 6, in a stable machine-readable artifact, always.

The division of labour is therefore:

| assertion | gates on | never gates on |
|---|---|---|
| `NF3` | the census ran and covered all six with recognised states | how many are published |
| `NF4` | **every fallback carries a disclosure** | whether any fallback exists |

`NF4` is vacuously true when there are zero fallbacks. **`NF6` is what stops that being a free
pass** — it renders a real fallback end-to-end on every run, whatever the dataset holds, and
checks its disclosure. The disclosure gate is therefore never untested, even on a fully
published site.

---

## 1. Scope — answered from the code, not assumed

The brief named six routes. Six is correct, and here is the derivation rather than the
assumption.

`grep -rln "loadShowPage" app/(marketing)/` returns exactly six route modules, and
`grep -rn "notFound" app/(marketing)/national-show/` returns exactly those same six plus
`archive/[year]/page.tsx`. The two sets coincide because a hard 404 on absent data is only
reachable through the `loadShowPage` → `if (!page) notFound()` pattern.

**In scope — the six:**

| slug | pageKey | archetype |
|---|---|---|
| `/national-show/programme` | `11-programme` | schedule |
| `/national-show/symposium` | `06-saoc-symposium` | prose |
| `/national-show/wosa-conference` | `07-wosa-conference` | prose |
| `/national-show/sa-exhibitors` | `04-south-african-exhibitors` | listing |
| `/national-show/international-guests` | `05-international-guests-and-exhibitors` | listing |
| `/national-show/sponsors` | `15-sponsors` | listing |

**Out of scope, with reasons — not omissions:**

- **The other 11 `listed: true` routes** call no `notFound()` and read no `showPage` document.
  Five carry hardcoded copy (`about`, `what-to-expect`, `plan-your-visit`, `faq`, `workshops`
  — `about` deliberately so, per D65/D69); five are the `saoc-eb` lane's transactional routes
  (`conferences`, `exhibitors`, `vendors`, `tickets`, `archive`); one is the hub. **None of
  them may acquire a `data-nos-content-state` marker** — see `NF10`. Their rendered output is
  frozen by R2/S1 and any change there outranks everything in this feature.
- **`/national-show/archive/[year]`** calls `notFound()` and keeps it. It is `listed: false`,
  `dynamic: true`, and an unrecorded year genuinely does not exist — 404 is the correct answer,
  not a failure to be papered over.
- **`/national-show/upcoming`** is deleted with no redirect and stays 404 (`L5`). It is not
  listed. Making it resilient would reinstate the artefact the ruling removed.

**A route acquiring a new hard 404 later is a regression, not a new feature.** `NF1` is the
standing guard: the `notFound(` call sites under `app/(marketing)/national-show/` must be
exactly `{archive/[year]}` forever.

### What this does not cover

A route that **throws** answers 500, not 404. F24 is a never-404 layer, not a never-500 layer,
and deliberately so — see §5.

---

## 2. The design — the fallback is a real `ShowPage`, built inside the gate

The fallback is **not** a new component with its own copy, its own disclosure and its own
design decisions. It is a synthesized `ShowPage` value rendered through the **existing**
`ShowPageProse` path.

```
loadShowPageOrFallback(pageKey, { label, purpose })
  → loadShowPage(pageKey)          — unchanged, still returns null when absent
  → null?  buildAbsentShowPage(...) — a real ShowPage, isFallback: true
```

Both new functions live in **`lib/data/show-pages.ts`** and nowhere else.

**Why there, specifically.** `wrapGatedProse` is import-restricted to exactly two files
(`lib/data/show-pages.ts` and `components/nos/ShowPageProse.tsx`), enforced by
`eslint.config.mjs` *and* `scripts/checks/assert-gated-prose-single-consumer.sh`, neither
trusting the other. Building the fallback anywhere else would require widening that boundary —
the one thing the provenance gate exists to prevent. Building it inside the module already
permitted to wrap means **the boundary is untouched and both guards keep passing unmodified.**

What this buys, all of it for free:

- **No new design work.** Brad's constraint, met literally: zero new components, zero new
  tokens, zero new colours. `ShowPageProse` is not read, not edited, not depended on for a
  ruling — it is simply *used*, exactly as the other five sections on those pages already use
  it. The R11/R17/R18 contradiction that blocks its rebuild is never reached.
- **R11's disclosure form (`N11`–`N14`) automatically.** Chip, sentence, dashed 2px rail down
  the full height of the governed block, warning tokens, never error/red — all inherited from
  the shared notice path. F24 introduces **no new disclosure form**, so it inherits whatever
  compliance state `N11`–`N14` are in and cannot drift from it independently.
- **The provenance gate applies to the fallback like any other block.** It is not an exemption
  carved into the gate; it is an input to it.

### Hard constraints on the builder

- **`loadShowPage` is not changed.** It keeps returning `null`. Every existing caller keeps the
  ability to tell absent from present, and `loadAllShowPages` is untouched. A "helpful" change
  making `loadShowPage` itself return the fallback would silently destroy that distinction
  everywhere at once — which is the whole defect, shipped as a convenience.
- **`buildAbsentShowPage` never assigns `pageProvenance` from a literal.** It sets its section's
  `provenance: 'placeholder-ai'` and lets the existing `resolvePageProvenance()` derive the
  page rollup. The gate decides; the builder does not get to declare itself clean.
- **`isFallback: true`** is the single source of truth for the marker. It is a new optional
  field on `ShowPage`; real documents leave it absent/false.
- **No `try`/`catch` around the load** (`NF9`). See §5.

### The marker must be STRUCTURAL, not author-remembered

*(Lead's hard requirement, 2026-09-10.)* If a page author can **forget** to add the marker,
then an undisclosed fallback is reachable, and `NF4`'s failure condition becomes unreliable in
the one direction that matters. **Rendering a fallback and emitting the marker must be the same
act**, incapable of coming apart.

A wrapper component the author remembers to use does not clear that bar. So:

`loadShowPageOrFallback` returns an **opaque** `ShowPageResult`, not a `ShowPage`:

```ts
export type ShowPageResult = { readonly __showPageResult: unique symbol };
```

There is no way through the type system for a route module to reach `.sections`, `.title` or
`.isFallback` on it. The single component that can open it is
**`components/show/nos/ShowContentState.tsx`**, and a route renders through it:

```tsx
<ShowContentState result={result} renderPublished={(page) => /* the route's own layout */} />
```

- The **published** branch is the author's, supplied as a render prop — the component still
  emits the marker around it.
- The **fallback** branch is rendered *entirely inside the component*. The author never writes
  it, so cannot omit its marker and cannot omit its disclosure.
- Both branches emit `data-nos-content-state` from the **same discriminant the component
  switched on**. One file, one expression, no second place to write it.

This is not a new enforcement idiom — it is the **same** opaque-brand + `eslint`
`no-restricted-imports` + grep-guard pattern the `GatedProse` boundary already uses and this
repo already trusts (`assert-gated-prose-single-consumer.sh`). Its sibling guard is
`scripts/checks/assert-content-state-single-consumer.sh`. The type brand alone never enforced
anything here and does not now: lint plus the grep guard are what make it real, exactly as
`gated-prose-internal.ts`'s header already records.

**It marks the content region only** — never the hero, never `ShowSectionNav`. That keeps
`NF13`'s text census clean and keeps the marked subtree equal to the governed block.

`data-` is already this codebase's marker idiom (`data-section-key` on `ShowPageProse`), so
this invents no convention either.

### Consumable from outside this repo's checker

The lead asserts on **this same marker** rather than building a parallel check, so the marker
has to be readable by tools that know nothing about `verify-nos-content-state.ts`:

- **It is in the server-rendered HTML** — present in the raw HTTP response body, not injected by
  client JS. A plain `curl | grep` sees it, as do BrowserAgent and any external gate. `NF16`
  asserts this by fetching with JavaScript disabled; a marker that only exists after hydration
  is invisible to half the tools that need it.
- **The vocabulary is pinned in `fixtures/f24-fallback-wording.json`** (`markerAttribute`,
  `markerValues`), a stable JSON file an external consumer can read instead of parsing prose.
- **The census is a stable artifact**, `.tmp/sandbox/nos-ia/content-state-census.json`, written
  on **every** run with per-route states and totals — including a `fallback` total of `0`.
  Never conditional on the count being non-zero.

---

## 3. Provenance — `placeholder-ai`, and why

Of the four values in `docs/rules/no-invention.md`, the fallback block carries **`placeholder-ai`**
(tone `warning`, per `N14`).

- **Not `council-supplied`.** Nothing council-authored is being rendered, and the gate would
  demand a resolving `sourcePath` plus sentence-level linkage it could never satisfy.
- **Not `council-draft`.** These are not the Council's words in any state.
- **Not `research`.** Its notice reads *"researched by the web team and has not yet been
  confirmed"* — which asserts that someone looked something up. Nobody did. The fallback makes
  **no claim about the show at all**, and borrowing `research` would describe it falsely.
- **`placeholder-ai`** is the only value whose notice claims no provenance for the words shown,
  and its text — *"Final copy is still to be supplied by the Council"* — is very nearly the
  literal truth of the situation.

**The consistency argument, which is the real one:** `resolvePageProvenance([])` already
returns `placeholder-ai` for a page with zero sections. A page with no document is the limiting
case of a page with no sections. Classifying it as `placeholder-ai` is the *existing* rule
applied to its edge, not a new rule invented for a new case. `classifySection`'s `default`
branch independently agrees.

Over-disclosure is the safe direction here; under-disclosure is the audited defect.

---

## 4. What the fallback may say — and what it may never say

The marked region contains **exactly three things**, in DOM order, and nothing else:

1. **The disclosure** — chip + notice sentence + rail, from the shared `placeholder-ai` notice
   path. Not authored here.
2. **The route's `purpose`, verbatim from `content/national-show-routes.json`.** Already
   published content — the hub flyout renders it today. It must be reproduced **byte-identical**,
   never edited, tightened or re-voiced (`NF13`).
3. **One fixed sentence**, pinned in `fixtures/f24-fallback-wording.json`:

   > The South African Orchid Council has not yet supplied the content for this page.

   One sentence. No claim about the show, its dates, its venue, its programme or its
   participants. No date, relative or absolute.

The `<h1>` is the route's `label` from the manifest — labels are ours to propose
(`route-manifest-schema.golden.md`). The hero keeps the route's existing image literal. The
section `heading` is `null`: an invented heading is invented content.

`summary` is `null`. **Nothing unconfirmed goes in the hero**, because the hero sits outside the
rail and the rail is what shows the extent of the claim.

### Banned outright (`NF11`)

`coming soon` · `no results` · `check back` · `watch this space` · `TBA` · `TBC` ·
`under construction` · `page not found`

And, absolutely: **no invented exhibitor, nursery, sponsor, guest, speaker, session or date.**
`RealEmptyListing`'s doctrine applies unchanged — an invented entity is an invented commercial
relationship with a real business.

### Not built: a breadcrumb

The brief mentions one. **This repo has no breadcrumb component**, and building one is design
work Brad's instruction forbids taking on here. `ShowSectionNav` — which exists, is already on
all six routes, and is required there by `L7`/`N15` — is what orients the reader. Flagged, not
silently substituted.

---

## 5. Absent is not the same as broken

`loadShowPage` returns `null` for *"the query ran and matched nothing."* A transport failure —
Sanity unreachable, a bad token, a malformed GROQ — **throws**.

**F24 adds no `try`/`catch` around the load** (`NF9`), so a thrown error stays thrown and
surfaces as a 500 through Next's error boundary. This is deliberate and it is the fails-closed
house style: swallowing exceptions into the fallback would render a Sanity outage as *"content
not yet published"* across the whole subsection — a calm, honest-looking lie, and exactly the
failure mode that makes a resilience layer worse than the 404 it replaced.

Residual, named rather than hidden: at the **page** level, an absent document and a query that
correctly returns zero documents are indistinguishable — they are the same fact. `NF8` is what
keeps that fact honest, by proving the loader really does produce `null` for an absent key and
non-null for a present one.

---

## 6. Proving the fallback can actually fire

**An assertion that cannot be made to fail today is not evidence.** Both directions are proved
end-to-end, against the real dataset, every run — not by unit-testing a branch in isolation.

- **Negative (`NF6`):** render the real shell with the reserved pageKey
  `__nos-absent-probe__` — a key asserted to exist in no seed and no dataset, and which
  therefore can never accidentally start passing. Real loader, real network, real component,
  real markup. Must produce `fallback-unpublished`, the label, the purpose, the fixed sentence
  and a disclosure — and **no** `published`.
- **Positive (`NF7`):** the same shell with a pageKey that does exist. Must produce `published`,
  **no** `fallback-unpublished`, and markup containing a real substring of that seed's body.
  **Real content wins over the fallback, and this is what proves it.**

`NF6` and `NF7` share one code path and differ only in input, so neither can be satisfied by a
stub that always answers one way.

---

## 7. Why `L1` alone is not enough — an amendment to `local-render.golden.md`

`L1` ("all 17 listed routes return HTTP 200") was a sufficient signal before F24 and **is not
one after it.** Post-F24, `L1` is green on a subsection with no content whatsoever.

`local-render.golden.md` gains a note to that effect. **`L1` itself is not modified and
`verify-nos-m4-local-render.ts` is not touched** — the eleven frozen routes' green assertions
outrank any tidiness gained by editing a passing verifier.

The hole is closed by conjunction instead, in a separate driver:

> **`L1`/`NF5` is meaningful only conjoined with `NF3`, `NF4` and the census artifact.**

`NF5` carries `insufficient_alone: true` in the contract, in writing, so nobody reads a green
`NF5` as evidence of a working page.

What replaces it is **not** another status-code assertion. It is the census (`NF3`) — which
publishes, on every run, exactly how many of the six are real pages and how many are shells —
paired with the disclosure gate (`NF4`), which fails the moment a shell stops saying it is one.
A green `NF5` beside a census reading `published 2 / fallback 4` is an honest, legible statement
that four menu links lead to shells. That is the outcome Brad asked for, reported rather than
hidden, and it is strictly better than either a 404 or a silent blank page.

The two are counted **independently of each other**, never one inferred from the other, so a
marker bug that loses a page entirely fails both rather than silently balancing.

---

## 8. The hole `F24` structurally cannot cover: a router-level 404

*(Lead's finding, 2026-09-10.)*

F24 replaces a `notFound()` **inside a page component that ran**. A `listed: true` route with
**no `page.tsx` at all** 404s at the Next router — before the fallback is anywhere in the call
stack. No fallback design fixes that, because no F24 code executes.

So *"menu links never 404"* is false for that class, and this golden must not claim otherwise.

**The specific instance is already handled:** the `/wosa` → `/wosa-conference` rename is in the
working tree as a `git mv` (staged, `R` in `git status`), and all 17 `listed: true` slugs
currently resolve to a `page.tsx`. Verified, not assumed.

**But the hole is a class, not an incident.** A future manifest row added without a route file
reintroduces it silently — and silently is the whole problem, because the manifest is what the
menu is built from, so the link appears the moment the row does.

`NF14` is the standing guard, and it is deliberately **independent of the fallback**: a
filesystem/router-level property, checked without rendering anything.

### Which ref it runs against — stated, because leaving it unstated is how this was missed

`NF14` checks **two trees**, because they can disagree and the disagreement is itself the trap:

| | tree | catches |
|---|---|---|
| `NF14a` | the **working tree** — what `next build` compiles | a manifest row with no route file at all |
| `NF14b` | the **git index** (`git ls-files`) — what actually deploys | a route file that exists locally and was never `git add`ed: renders fine on localhost, 404s on the host |

A working-tree-only check passes on a machine where the file is untracked and the deployed site
still 404s. `NF14b` is what closes that, and it is the half that would otherwise be assumed
rather than checked.

Both are green today on this branch — the rename is staged, so the index already carries
`app/(marketing)/national-show/wosa-conference/page.tsx`. `NF14` is therefore a pure regression
guard from the moment it lands, which is exactly what it should be.

# Golden — the content-state verifier (`NF1`–`NF16`)

The driver that makes the three states of `never-404-fallback.golden.md` machine-separable,
that gates on **disclosure rather than content presence**, and that covers the router-level
404 the fallback structurally cannot reach.

---

## Driver

`scripts/checks/verify-nos-content-state.ts` → `.tmp/sandbox/nos-ia/content-state-results.txt`

**A NEW driver, not an edit to `verify-nos-m4-local-render.ts`.** That verifier guards eleven
frozen routes with live green assertions in `contract-m4.yaml`; the lead's ranking is explicit
— *any regression there outranks everything in this feature.* A separate file, a separate
results manifest and separate exit codes mean F24 cannot break M4's gate no matter what it gets
wrong.

Conventions are inherited verbatim from `local-render.golden.md`, so the two read alike:

- Exit **0** all passed · **1** a check failed · **2** the harness itself broke, **never
  collapsed into 1**.
- **Every id is written on every run**, PASS or FAIL. An unwritten id is exit 2 — a check that
  silently fails to emit must not be indistinguishable from one that passed.
- Manifest lines are two colon-free tokens (`NF3 PASS`) so each assertion is an unquoted grep.
  Detail goes on a separate `#`-prefixed line, never on the verdict line.
- Probe `http://localhost:3000` first and reuse it if it answers; otherwise start a dev server
  on a free port and stop it at the end. Record `SERVER reused` or `SERVER started <port>` so a
  green run cannot hide that it tested nothing.
- Lives in `scripts/checks/`, **never `execution/`** — that tree is HARNESS-owned and the next
  `make update-template` deletes it, taking the gate with it. `contract-m4.yaml` already
  asserts that absence; F24 must not violate it.
- Playwright, headless. Never Claude-in-Chrome.

### The reconciliation rule — general, not local to this driver

**Every summary a verifier prints must reconcile: the per-verdict buckets sum to the declared
total, and every declared id is accounted for in exactly one bucket. A summary that cannot be
reconciled is a harness fault (exit 2), never a pass.**

This is stated as a general rule because it was just violated in the driver next door. The lead
found that `verify-nos-m4-local-render.ts` prints `TOTAL=13` while its buckets account for only
12: `record()` is typed `(id, verdict: Verdict | string, …)`, and the `| string` escape hatch
lets `SERVER` record the literal `"reused 3002"` — which is none of the four verdicts, so the
bucket counts silently drop it. Nothing asserts the two agree.

Read the comment sitting directly above that signature: *"every id in `ALL_CHECK_IDS` gets one
of these four, and the summary line below counts them separately so `N/M PASS` can never quietly
absorb a SKIP or an UNMEASURED into the numerator."* **The `| string` makes that comment false.**
The invariant is asserted in prose and unenforced in the type.

It is benign there today. It is also **the reporting-collapse class living inside the fix for
the reporting-collapse class**, which is exactly why the rule belongs in a golden rather than in
one driver's review notes.

`verify-nos-content-state.ts` must not inherit it, and this golden's own "conventions are
inherited verbatim" line above is what would have caused it to. So, concretely:

- **`record()` takes `Verdict`, with no `| string` widening.** There is no way to write a
  non-verdict into a verdict slot.
- **`SERVER` is not a check id.** It is emitted as an informational `# SERVER reused <port>`
  line, outside `ALL_CHECK_IDS` entirely. The reconciliation is then exact rather than fudged
  by an exemption — an exemption is how the next `SERVER` gets added.
- **`NF18` asserts the reconciliation held** on every run: buckets summed to
  `ALL_CHECK_IDS.length`, every id present exactly once. A mismatch exits **2**, never 1 — a
  verifier that cannot count itself has not failed a check, it has broken.

The same discipline is why `A18` requires the census totals to sum to six rather than merely
existing. A count nobody cross-foots is a count nobody is checking.

`ALL_CHECK_IDS = ['NF1'…'NF18']` — **verdict-bearing ids only.** `SERVER` is deliberately NOT
among them; see the reconciliation rule below. `NF14a`/`NF14b` are reported under the single id
`NF14`; its detail line names which half failed.

---

## Check ids

### Scope and structure

| id | check | fails when |
|---|---|---|
| `NF1` | The `notFound(` call sites under `app/(marketing)/national-show/` are **exactly** `archive/[year]/page.tsx`. And the route modules calling `loadShowPageOrFallback` are **exactly** the six in-scope slugs — both directions, set equality. | a seventh route gains a hard 404; one of the six regains one; a route is added to or dropped from the resilient set without the contract being revised |
| `NF2` | Each of the six renders **exactly one** element carrying `data-nos-content-state`, whose value is one of `published` / `fallback-unpublished`. | count is 0 (marker lost — the page could be blank and nothing would notice) or ≥2 (two branches rendered, states no longer exclusive) or the value is unrecognised |

`NF2`'s count is `=== 1`, never `>= 1`. Zero and two are both real failure modes and both are
how a census silently becomes meaningless.

### The census, and the disclosure gate

**Revised 2026-09-10 on the lead's ruling.** An earlier draft made `NF3` gate on
`published == 6`. That is wrong, but **not** for the reason first given here: the struck
argument was that such a gate would sit red for months on a property nobody controls. Commit
`db6cd81d` re-seeded production the same day, so `published == 6` would in fact be **green
today** — see `never-404-fallback.golden.md` §0. The sound reason is the other one:
**content presence is not the property F24 exists to protect.** F24 is the fallback machinery;
whether a document exists belongs to the seeding lane. **Honest disclosure is what this feature
owns**, and `NF17` below is what watches the part that is no longer being gated.

| id | gates on | explicitly does NOT gate on |
|---|---|---|
| `NF3` | the census **ran and is complete** — all six routes present, each with a recognised state, totals internally consistent and equal to six | how many are published |
| `NF4` | **every route rendering `fallback-unpublished` carries a disclosure** inside its marked subtree: a chip element with non-empty text and non-empty notice text | whether any fallback exists at all |

**PASS on a disclosed fallback. FAIL on an undisclosed one.** The failure condition is not
"this page is a shell" — it is "this page is a shell and does not say so".

#### `NF3` gates on the metric running, not on its value

`.tmp/sandbox/nos-ia/content-state-census.json` is written on **every** run — every route, its
state, and the totals — **including a `fallback` total of `0`.** Never conditional on the count
being non-zero.

That is the whole point. *A metric that appears only when non-zero is indistinguishable from a
metric that is not running*, and a number nothing gates on is exactly how the skip-as-pass
defect landed. So `NF3` fails when the census is missing, short a route, carries an
unrecognised state, or its totals do not sum to six — and passes at `published 2 / fallback 4`,
loudly, with the numbers on the record.

```json
{
  "schema": "saoc.nos-content-state-census/v1",
  "generatedAt": "<ISO-8601>",
  "totals": { "published": 6, "fallback": 0, "total": 6 },
  "routes": [ { "slug": "/national-show/programme", "state": "published", "disclosed": null } ]
}
```

`disclosed` is `true`/`false` for a fallback and `null` for a published route — so an external
consumer can re-derive `NF4`'s verdict without trusting this driver's own PASS line.

#### `NF4` is vacuous on a fully published site — and `NF6` is why that is not a free pass

With zero fallbacks, `NF4` passes having tested nothing. That is correct behaviour (there is
nothing to disclose) and it would be a serious weakness on its own.

**`NF6` closes it.** It renders a real fallback end-to-end on every run, whatever the dataset
holds, and asserts the disclosure is there. The disclosure gate is therefore never untested,
even when every route is published — which is the state this repo expects to be in most of the
time, and therefore the state the gate has to keep working in.

### `NF17` — the content-presence tripwire, reported separately from the gate

| id | check |
|---|---|
| `NF17` | The live census matches `fixtures/f24-content-baseline.json` — every route baselined as expected-published renders `published`, and the published set matches the baseline exactly. |

**Why it has to exist.** With disclosure as the gate, every other id here stays green on a
subsection that has silently gone empty: `NF4` because the shells are disclosed, `NF3` because
the census ran and summed to six, `A18b` because the artifact is well-formed. The fallback
machinery would be fully verified while the content it substitutes for had vanished — the same
defect shape as everything else this mission fixed today, one level up.

**Three verdicts, not two**, because a two-valued check cannot tell a broken seed from a
deliberate retirement:

| verdict | line | meaning |
|---|---|---|
| pass | `NF17 PASS` | live set matches the baseline |
| regression | `NF17 FAIL` | **the tripwire fired** — a baselined route is now a shell; the detail line names the route and its seed file |
| drift | `NF17 DRIFT` | a page was added or retired without the baseline being updated |

`DRIFT` is a distinct token so the contract's `grep -q '^NF17 PASS$'` still fails on it — a
drifting baseline is not a pass — while the operator sees immediately that this is a
bookkeeping gap, not a content regression, and knows the fix is to edit the baseline in the
commit that changed the tree.

**`NF17` is reported on its own line with its own vocabulary and is not folded into the gate
verdict.** `NF4` is the gate. This is a distinct signal about content, and it is deliberately
legible as one.

### `NF18` — the driver can count itself

| id | check |
|---|---|
| `NF18` | The run's own summary reconciles: the per-verdict buckets sum to `ALL_CHECK_IDS.length`, and every declared id appears in exactly one bucket. |

Self-referential on purpose. A verifier whose summary does not add up cannot be trusted about
anything else it reported, so this is checked before any of its other verdicts are believed. A
mismatch exits **2** (harness broke), never 1 (a check failed) — the distinction matters,
because exit 1 says "the code under test is wrong" and exit 2 says "stop reading my output".

### The 200 check, explicitly labelled insufficient

| id | check |
|---|---|
| `NF5` | all 17 listed routes return HTTP **200** |

Carries **`insufficient_alone: true`** in the contract. Post-F24 this is green on a subsection
with zero content. It is meaningful **only** conjoined with `NF3` and `NF4`, and the contract
says so in writing next to the assertion, not only here.

### Proving the fallback can fire — the discriminators

| id | check |
|---|---|
| `NF6` | **Negative, end-to-end — and the thing that keeps `NF4` honest.** The real shell, real loader, real dataset, reserved pageKey `__nos-absent-probe__`. Markup must carry `data-nos-content-state="fallback-unpublished"`, the route label, the route `purpose` byte-identical, the pinned fixed sentence, and **a disclosure with a non-empty chip and non-empty notice text** — and must **not** contain the substring `"published"` as a marker value. Runs every gate, whatever the dataset holds, so the disclosure gate is exercised even on a fully published site. |
| `NF7` | **Positive, end-to-end.** Same shell, same code path, a pageKey that exists. Markup must carry `published`, must **not** carry `fallback-unpublished`, and must contain a ≥40-character substring of that seed's real body text. Real content wins, demonstrated rather than asserted. |
| `NF8` | `loadShowPage('__nos-absent-probe__')` resolves to `null`; `loadShowPage(<a real key>)` resolves non-null with `isFallback` absent or false. The `null` the fallback consumes is really produced by the real loader for a real absent key. |
| `NF12` | `__nos-absent-probe__` appears as a `pageKey` in **zero** files under `scripts/seed*`, `content/`, and in **zero** documents in the live dataset. The negative probe can never accidentally start passing. |

`NF6` and `NF7` differ **only in their input**, so no stub that always answers one way satisfies
both. `NF6` cannot rot into a tautology because `NF12` keeps its key absent by assertion.

### No-invention and no-swallow

| id | check |
|---|---|
| `NF9` | `loadShowPageOrFallback`'s body contains no `try` and no `catch`. A transport error surfaces as an error, never as a fallback (`never-404-fallback.golden.md` §5). |
| `NF11` | The fixed sentence in the rendered fallback equals `fixtures/f24-fallback-wording.json`'s `fixedSentence` exactly, and **none** of that file's `bannedPhrases` appears anywhere in the marked subtree — case-insensitive. |
| `NF13` | **Text census.** The normalized visible text of the `fallback-unpublished` subtree equals exactly the union of: the notice label, the notice text, the route's manifest `purpose`, and the fixed sentence. **Any other prose is invented content and fails.** |

`NF13` is the strongest no-invention guard available and the reason the marker wraps the content
region only — a marker on the page root would drag the hero and `ShowSectionNav` into the census
and force it to be loosened into uselessness.

### Regression guard on the eleven

| id | check |
|---|---|
| `NF10` | The 11 listed routes that do **not** consume the shell render **zero** `data-nos-content-state` elements. |

The other half of the regression guard is not in this driver at all: the contract re-asserts
`L1`, `L2`, `L3`, `L4` and `L7` still PASS in the **untouched** M4 driver's own results file. A
verifier that proves it did not break the frozen routes is worth more than one that promises it.

### The router-level hole — what the fallback structurally cannot cover

| id | check |
|---|---|
| `NF14` | Every `listed: true` row in `content/national-show-routes.json` has a corresponding `page.tsx` — **`NF14a`** on the **working tree** (what `next build` compiles) and **`NF14b`** in the **git index** via `git ls-files` (what actually deploys). |

**Independent of the fallback, and deliberately so.** A route with no `page.tsx` 404s at the
Next router before any F24 code runs, so no rendering check can see it — `NF14` never starts a
browser and never fetches a URL. It compares two sets of strings.

Both trees are checked because their disagreement *is* the trap: a route file that exists
locally but was never `git add`ed renders perfectly on localhost and 404s on the deployed host.
A working-tree-only check calls that green. Stating the ref is not pedantry here — an unstated
tree is how this class was missed in the first place.

### The marker is structural, and externally consumable

| id | check |
|---|---|
| `NF15` | **Structural emission.** `ShowContentState.tsx` emits `data-nos-content-state` on **both** branches from the same discriminant it switched on; **no other file** constructs or opens a `ShowPageResult` (grep guard, sibling to `assert-gated-prose-single-consumer.sh`); and **no in-scope route module accesses `.sections` directly**. Rendering a fallback and emitting the marker are the same act. |
| `NF16` | **Server-rendered and externally readable.** Fetched with **JavaScript disabled**, the raw HTTP response body of each of the six contains the marker. A marker injected at hydration is invisible to `curl`, to the lead's own check, and to half the tools that need it. |

`NF15` is the assertion that makes `NF4`'s failure condition trustworthy. If an author could
forget the marker, an undisclosed fallback would be reachable and `NF4` would go green over it —
unreliable in the one direction that matters.

`NF16` is what lets the lead assert on **this** marker instead of building a parallel check.
Two other consumers exist for the same reason: the pinned vocabulary in
`fixtures/f24-fallback-wording.json` (`markerAttribute`, `markerValues`), and the census
artifact's per-route `state` + `disclosed` fields, from which any external tool can re-derive
`NF4`'s verdict without trusting this driver's own PASS line.

---

## What this driver does not prove

- **That the page looks right.** `N1`–`N15` and Codi's eye do that.
- **That the copy is correct** when it is present. The linkage and provenance checks do that.
- **That the deployed build matches.** `browser_deployed_check` (`D31`) does that, after push.
- **That an absent document and an empty-but-successful query are different things.** At the
  page level they are the same fact. `NF8` is the closest available proof and it is a proof
  about the loader, not about Sanity's intent.

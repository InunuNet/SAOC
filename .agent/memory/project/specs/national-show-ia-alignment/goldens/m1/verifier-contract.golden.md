# Golden — the M1 verifier's contract

## The commissioned script

`scripts/checks/verify-show-page-m1.ts`, run as
`node_modules/.bin/tsx scripts/checks/verify-show-page-m1.ts`.

**It lives in `scripts/checks/`, not `execution/checks/`.** `.agent/update-manifest.yaml:12`
classifies `execution/` as HARNESS wholesale, so anything written there is deleted without
warning by the next `make update-template`. Earlier contracts in this repo put verifiers
under `execution/checks/` — that is a latent defect those contracts inherit, and M1 does
not copy it. Assertion A0_NOT_IN_HARNESS pins the decision.

## Exit-code contract

| exit | meaning |
|---|---|
| 0 | every check passed |
| 1 | at least one check FAILED — a real defect in the implementation |
| 2 | the verifier itself could not run — a missing import, a syntax error, an unreadable file. **Never collapsed into 1.** A broken harness must not be reported as a passing or failing implementation. |

## Results manifest

Written to `.tmp/sandbox/nos-ia/m1-results.txt` (in-project sandbox per
`.claude/rules/sandbox.md`; `.tmp/` is gitignored). One line per check, exactly:

```
S1 PASS
S2 PASS
G3 FAIL
R1 SKIP
```

Two tokens, one space, no colons, no JSON. The third token value `SKIP` marks a check that
belongs to a later milestone and cannot run yet; since every contract assertion greps for
`PASS`, a SKIP can never read as green. The format is deliberately colon-free so each
contract assertion can be an unquoted one-line `grep -q '^S1 PASS$'` with no YAML quoting
hazard. Every check id below MUST appear in the file on every run, PASS or FAIL — a check
that silently fails to emit its line would let `grep -q` fail in a way indistinguishable
from a real defect, so the verifier writes the full id list first and overwrites verdicts
as it goes, and exits 2 if any id is still unwritten at the end.

The verifier must also print a human-readable failure line to stderr for every FAIL,
naming the id, what was expected and what was found. A gate that says only "FAIL G3" costs
a debugging session.

## Check ids

### S — schema, driven against the imported schema objects, never against file text

| id | check |
|---|---|
| S1 | `showPageSection.provenance` exists, `type: 'string'`, and its `options.list` values are exactly the set `council-supplied`, `research`, `placeholder-ai` — no more, no fewer |
| S2 | `showPageSection.provenance` has **no** `initialValue` property (absent, not merely undefined-valued) — the mission's central schema property |
| S3 | `showPageSection.provenance` has a `validation` function, and calling it against a Rule spy records a `required()` call |
| S4 | `showPage.pageKey` is required with a regex; `showPage.sections` is required with `min(1)`; `showPage.specNumber` is required |
| S5 | `showPageSettings` has all four label fields and each is required |
| S7 | `showPage.specNumber` **rejects 14** and accepts 1-13 and 15-18. The field's own description says entry 14 is never a document; a validation rule that allows it makes the description a comment rather than a constraint. Driven by calling the field's validation against each of 0, 1, 13, 14, 15, 18, 19 and a non-integer. |
| S6 | `showPage`, `showPageSettings` and `showPageSection` are present in `sanity/schemas/index.ts`'s exported `schemaTypes`; `showPageSettings` is in `PINNED_SINGLETON_TYPES` and has a `SINGLETON_TITLES` entry; `showPage` is in `COLLECTION_TYPES` |

### G — the gate, driven against the real `resolveNotice` and the real `ShowPageProse`

Each G row corresponds to rows of the fail-loud table in `provenance-gate.golden.md`.

| id | check |
|---|---|
| G1 | `resolveNotice` returns `null` for a `council-supplied` section whose `sourcePath` resolves to an existing file — and this is the ONLY input in the whole suite for which it returns null |
| G2 | returns a notice for: `council-supplied` with absent `sourcePath`, `council-supplied` with an empty `sourcePath`, `council-supplied` naming a nonexistent file, `research`, and `placeholder-ai` |
| G3 | returns the **placeholder** notice for `provenance` of `null`, `undefined`, `''`, and the unrecognised string `'confirmed'` — and the implementing `switch` reaches these through an explicit `default` branch |
| G4 | with `showPageSettings` absent, and again with each label field blank, a placeholder section still yields a notice whose `label` and `text` equal the hardcoded fallback constants, which equal the fixed wording in `provenance-gate.golden.md` verbatim |
| G5 | `pageProvenance` rollup: all-clean sections yields `council-supplied`; one `research` among clean yields `research`; one `placeholder-ai` anywhere yields `placeholder-ai`; **zero sections yields `placeholder-ai`** |
| G6 | rendering `ShowPageProse` for a placeholder section produces markup in which `indexOf(noticeText)` is less than `indexOf(bodyText)` — measured on the rendered string, not read from the JSX |
| G7 | `ShowPageProse`'s props type has exactly one key (`section`), and rendering every section fixture that carries a notice produces that notice's text in the output |
| G12 | **The `GatedProse` renderer boundary, proved in both directions.** (a) No file under `app/` or `components/` — other than `components/nos/ShowPageProse.tsx` — imports the renderer-private unwrap module, and `lib/data/show-pages.ts` no longer exports `__unsafeUnwrapGatedProse` or any equivalent public opener. (b) **The check is run against a committed copy of @qa's bypass probe and MUST report a violation** — if the probe passes, the check is broken and G12 fails. A boundary check nobody has watched fail is not a boundary check. (c) The ESLint `no-restricted-imports` rule fires on the same fixture. |
| G11 | **`sourcePath` containment, driven in BOTH directions.** A section is clean ONLY when its `sourcePath` is repo-relative, contains no `..` segment, begins with `content/drive-source/` or `content/drive-recovered/`, and its **resolved** path stays inside that root and names a real file. Accept case: a real `content/drive-recovered/17-faq/faq/content.md` classifies clean. Reject cases, each of which MUST classify **placeholder**: `/etc/hosts` (absolute, exists); `../../etc/hosts` (traversal); an absolute path to a real file inside the repo; `content/drive-source-evil/x.md` (prefix-lookalike, defeats a `startsWith` test); `content/drive-source/../../package.json` (traversal that resolves outside after a valid prefix); and a well-formed path naming a file that does not exist. Both the loader and the Sanity schema are driven — neither is allowed to rely on the other. |
| G10 | the placeholder notice text carries an **AI-generation disclosure** — the resolved placeholder notice matches `/\bAI[- ]generated\b/i` — checked against BOTH the hardcoded fallback constant in `lib/data/show-pages.ts` AND the value the seed writes to `showPageSettings.placeholderNotice`. G4 pins the exact string; G10 pins the property that must survive any rewording. |
| G8 | the value at `section.body` returned by the loader is the `GatedProse` shape — it is not an array of portable-text blocks, and passing it to a portable-text renderer is a compile error (proved by a `// @ts-expect-error` fixture that `tsc` must accept) |

### D — the drive recovery tree

| id | check |
|---|---|
| D1 | all four `content.md` files and their four `recovery.json` siblings exist at the exact paths in `drive-recovery.golden.md` |
| D2 | every `recovery.json` parses and carries `specPage` (integer 1..18), `sourceDrivePath` (non-empty), `sourceMd5` (32 lowercase hex), `method` (one of the three enumerated values), `recoveredAt` (ISO date), `recoveredBy`, and a `supersededBy` key present even when null |
| D3 | for every recovery entry, if a `content/drive-source/` manifest exists for the same Drive file, report whether its md5 still equals `sourceMd5` — a mismatch means the salvage has been superseded and is reported, not silently kept |
| D5 | the string `Stellenbosch Flying Club` and the string `From Wild Origins to Cultivated Excellence` each appear in the recovery tree |
| D6 | the council's venue sentence survives **verbatim** wherever it is reused — the exact string `Stellenbosch Flying Club, R44 northbound to Stellenbosch` appears in the recovery tree, and any seed section quoting the venue reproduces it character-for-character. This is the check that would have caught the R44 paraphrase directly, rather than leaving it to a reviewer. |

### P — the seed corpus, read with no Sanity token and no network

| id | check |
|---|---|
| P1 | exactly 17 files in `content/show-pages/`, and the set of their `specNumber` values is exactly {1..13, 15..18} — 14 absent, because spec entry 14 is a link and not a page |
| P2 | every `pageKey` matches `/^[0-9]{2}-[a-z0-9-]+$/` and equals its filename stem; all 17 are distinct |
| P3 | every section carries a `provenance` drawn from the three-value enum, and a `sectionKey` unique within its page |
| P4 | every section with `provenance === 'council-supplied'` has a `sourcePath` that is repo-relative, starts with `content/drive-source/` or `content/drive-recovered/`, and resolves to a file that exists |
| P6 | no section **we generated** states a ticket price — see "P6, and why the first version was broken" below. Council-supplied sections are exempt. |
| P7 | no seed source exists for spec entry 14 and no `pageKey` begins `14-`; and no `pageKey` or `title` in the corpus contains `home` **as a whole word** (case-insensitive `\bhome\b`, so a title like "Homegrown Orchids" is not forced to change), so the landing page can never be modelled as a site root |

#### The G12 fixture must be committed, not read from the sandbox

@qa's probe lives at `.tmp/sandbox/nos-ia/qa-bypass-attempt.tsx`. **`.tmp/` is gitignored**
(`.gitignore:3`), so a check that reads it there passes vacuously on a fresh checkout — the
fixture is missing, nothing is detected, and the "we watched it fail" property silently
evaporates on the one machine that matters, CI.

So G12 drives a **committed** copy at
`scripts/checks/fixtures/gated-prose-bypass-attempt.tsx.txt`, beside the existing
`gated-prose-type-guard.ts`. The `.txt` suffix keeps it out of the TypeScript project's own
compilation while leaving it readable by the check and by the lint-rule test.

The sandbox original stays exactly where it is — `.claude/rules/sandbox.md`, an agent never
deletes a sandbox file — and is the provenance record for how the fixture was found.

**If the fixture is absent, G12 FAILS.** It does not skip. A self-testing check whose
self-test is missing has no more standing than no check at all.

#### P6, and why the first version was broken

The first P6 matched `/\bR\s?\d{2,4}\b/` across every seed body. That regex matches **`R44`** —
the national road the venue sits on. The council's only written statement of the venue is
*"Stellenbosch Flying Club, R44 northbound to Stellenbosch"*, and the assertion made that
sentence unpublishable. @dev paraphrased around the road number to get the gate green, which
degraded a confirmed fact a visitor actually needs in order to arrive.

**The principle this fix encodes: an assertion that can only be satisfied by altering the
client's factual content is broken — the content is not.** P6 exists to stop *us* publishing
unconfirmed prices. It has no business policing words the council wrote.

Two changes, and the first is the real one:

**1. Scope P6 to copy we generated.** It applies only to sections whose `provenance` is
`placeholder-ai` or `research`. `council-supplied` sections are exempt. This is the same rule
already governing the WOSA boundary checks (`goldens/m3/wosa-content-boundary.golden.md`), and
it is the correct rule for the same reason: we police our own words, not the client's. It fixes
the R44 case at the root, because the venue sentence is council-supplied.

**2. Discriminate a price from a route designation** in the copy we *do* police, so a generated
"getting there" section can name the road without tripping the gate:

```
PRICE_CANDIDATE = /\bR\s?\d{1,3}(?:[ ,]?\d{3})*(?:\.\d{2})?\b/
ROUTE_KEYWORD   = /^\W{0,3}(northbound|southbound|eastbound|westbound|highway|freeway|
                   motorway|route|road|off-?ramp|on-?ramp|turn-?off|toward|towards|exit)\b/i
ROUTE_ALLOWLIST = R44 R45 R101 R102 R304 R310 N1 N2 N7 M3
LOOKAHEAD       = 30 characters
```

Per candidate: **a decimal part is decisive — `R44.00` is a price, always.** Otherwise, skip it
if a route keyword follows within 30 characters, or if the token is a known SA route
designation. Everything else is a price and fails the check.

The thousands separator is optional (`[ ,]?`), which the first draft of this fix got wrong: with
a required separator, `R1500` — the Couple cocktail price straight out of the ticketing document
— was missed entirely. A price check with a hole in it is worse than none, because it is
believed.

**Dry-run, both directions, 19/19.** Catches `R130.00`, `R 380`, `R150`, `R800`, `R1500`,
`R300`, `R100`, `R1 500`, `R200`, `R380`, `R2 500`, and `R44.00`. Does not catch `R44
northbound`, `R44 towards`, `R310 road`, `N1 highway`, `R44 turn-off`, `the venue is on the
R44.`, or times like `09:00`.

**Known limit:** a generated sentence naming a road that is neither in the allowlist nor
followed by a route keyword — "the venue is off the R62" — still fails. That is a false positive
of the same family, and the fix when it happens is to add the route to the allowlist, **never**
to reword the sentence. Written here so the next person hits the right lever.

### R — the route map

| id | check |
|---|---|
| R1 | every route named in `route-map.golden.md` as CREATE or RECONCILE has a `page.tsx` under `app/(marketing)/national-show/`, and every `showPage` seed source's `pageKey` maps to exactly one such route |
| R2 | the untouchable routes are unmodified against HEAD: `tickets/`, `vendors/`, `archive/`, `upcoming/`. `conferences/` and `exhibitors/` keep their routes and their content, but may gain a cross-link to the new pages — a link out is not a restructure |
| R3 | every route created by this mission is reachable by clicking — it appears in at least one of `components/chrome/nav-config.ts`, `components/show/ShowSectionNav.tsx`'s `SECTION_LINKS`, or the landing page's quick links. A 200 that nothing links to is the `/national-show/archive` defect repeating |
| R4 | a link to `/societies` exists in the National Show navigation (spec entry 14, which has no page of its own) |
| R5 | no file under `app/(marketing)/national-show/` declares a colour, font-family, border-radius or box-shadow literal — the NOS identity is inherited from the layout's `.nos-theme` scope, never re-declared (CLAUDE.md, no invented brand assets) |

R1, R3 and R4 are M4 checks and are reported as SKIP by the M1 run — the routes do not exist
yet. R2 and R5 run from M1 onward. The verifier emits `SKIP` as a third verdict token for
these; a contract assertion greps for PASS, so an M4 check cannot accidentally read as green
during M1 — the M1 contract simply does not assert them.

### N — the seed script's safety properties

| id | check |
|---|---|
| N1 | `scripts/seed-show-pages.ts` exports `decideSectionAction` and `hashBody`, and calling `decideSectionAction` performs no filesystem or network access (drive it with the module's Sanity client import stubbed; if the module cannot be imported without credentials, that is itself a FAIL — the pure half must be importable in a gate) |
| N2 | `decideSectionAction` returns exactly the expected value for all six rows of the decision table in `seeding-reconciliation.golden.md`, including `skip-edited` on a hash mismatch and `skip-unknown-origin` on an absent or empty `seedHash` |
| N3 | `hashBody` is stable under object-key reordering — two bodies differing only in key order hash identically |

## What the verifier does NOT prove

- It does not touch a Sanity dataset. Every S, P and N check reads source files and the
  committed corpus; no check proves what is actually in the live dataset today.
- It does not prove an editor told the truth in Studio. P4 checks the committed seed
  sources only. See the gate golden's limitation 1.
- It does not measure anything visual — contrast, focus order, or whether the notice is
  actually noticeable to a reader. G6 proves DOM order and nothing more.

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
| G8 | the value at `section.body` returned by the loader is the `GatedProse` shape — it is not an array of portable-text blocks, and passing it to a portable-text renderer is a compile error (proved by a `// @ts-expect-error` fixture that `tsc` must accept) |

### D — the drive recovery tree

| id | check |
|---|---|
| D1 | all four `content.md` files and their four `recovery.json` siblings exist at the exact paths in `drive-recovery.golden.md` |
| D2 | every `recovery.json` parses and carries `specPage` (integer 1..18), `sourceDrivePath` (non-empty), `sourceMd5` (32 lowercase hex), `method` (one of the three enumerated values), `recoveredAt` (ISO date), `recoveredBy`, and a `supersededBy` key present even when null |
| D3 | for every recovery entry, if a `content/drive-source/` manifest exists for the same Drive file, report whether its md5 still equals `sourceMd5` — a mismatch means the salvage has been superseded and is reported, not silently kept |
| D5 | the string `Stellenbosch Flying Club` and the string `From Wild Origins to Cultivated Excellence` each appear in the recovery tree |

### P — the seed corpus, read with no Sanity token and no network

| id | check |
|---|---|
| P1 | exactly 17 files in `content/show-pages/`, and the set of their `specNumber` values is exactly {1..13, 15..18} — 14 absent, because spec entry 14 is a link and not a page |
| P2 | every `pageKey` matches `/^[0-9]{2}-[a-z0-9-]+$/` and equals its filename stem; all 17 are distinct |
| P3 | every section carries a `provenance` drawn from the three-value enum, and a `sectionKey` unique within its page |
| P4 | every section with `provenance === 'council-supplied'` has a `sourcePath` that is repo-relative, starts with `content/drive-source/` or `content/drive-recovered/`, and resolves to a file that exists |
| P6 | no seed source body contains a South African rand price token (`/\bR\s?\d{2,4}\b/`) |
| P7 | no seed source exists for spec entry 14 and no `pageKey` begins `14-`; and no `pageKey` or `title` in the corpus contains the word "home", so the landing page can never be modelled as a site root |

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

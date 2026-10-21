# Spec: nos-provenance-fix (false "AI-generated placeholder" notices on council-supplied NOS sections)

- **Mission:** nos-provenance-fix (P1, assigned to NOS Site by the lead, saoc-2b, 2026-10-15)
- **Author:** @architect, 2026-10-15
- **Status:** DRAFT. Awaiting operator approval. It touches the secrets boundary, so no contract and no @dev until approved.
- **Read at:** InunuNet/SAOC `origin/main` = `5ae1f3cf`, via `.tmp/sandbox/wosa` (read-only `git show`). The local `content/drive-source/` read is from this project root, where the tree exists on disk but is gitignored.

## 1. Problem

Council-supplied NOS sections render a false notice on beta: "AI-generated placeholder / awaiting official copy".
`/national-show/sa-exhibitors` is the reported case.

The gate fails closed on purpose, which is correct behaviour. But on beta it fails closed on true content.
The section claims `provenance: "council-supplied"` with a `sourcePath` under `content/drive-source/`.
That tree is gitignored wholesale, because Lee-Ann's spec doc carried plaintext mailbox passwords and leaked once in `1d6512cb`.
App Hosting builds from the GitHub repo, so the file never exists on the server.
`sourceFileExists()` therefore returns false, and the section is classified `placeholder`.

The fix has to make the provenance signal work on beta without any gitignored file entering the repo or the deploy.
It must also keep the linkage check, which confirms that the body text is linked to the source. That check is a no-invention safeguard.

## 2. Evidence (origin/main 5ae1f3cf)

| # | where | what it shows |
|---|---|---|
| E1 | `lib/data/show-pages.ts:170` | `ALLOWED_SOURCE_ROOTS = ['content/drive-source', 'content/drive-recovered']`. Both roots are already allowed. |
| E2 | `lib/data/show-pages.ts:193-224` | `sourceFileExists()`: `existsSync` + `realpathSync` containment + `isFile`. A missing file returns false. |
| E3 | `lib/data/show-pages.ts:286-293` | `bodyLinkedToSource()`: every normalised sentence of 25 characters or more must occur verbatim in the normalised source. |
| E4 | `lib/data/show-pages.ts:299-305` | `readSourceTextForLinkage()`: a runtime `readFileSync(path.resolve(process.cwd(), sourcePath))`. |
| E5 | `lib/data/show-pages.ts:328-366` | `classifySection()`: for `council-supplied`, no file means `placeholder` (l.336). For `council-draft`, no file means `placeholder` (l.352). |
| E6 | `lib/data/show-pages.ts:470-485` | `hydrateSection()` classifies the **Sanity** document's `sourcePath` and body, not the seed JSON. Fixing beta means correcting the Sanity docs as well as the seeds. |
| E7 | `.gitignore:144` (and l.121, l.125) | `content/drive-source/` is ignored wholesale. `content/drive-recovered/**/*.docx` is ignored, but `content.md` and `recovery.json` in that tree ARE tracked. |
| E8 | `scripts/checks/verify-show-page-m3.ts:304-345` | Check C4 runs a credential scan over `content/show-pages/**` and `content/drive-recovered/**`. That is an existing secret gate on exactly the tree option A uses. |
| E9 | `scripts/checks/verify-show-page-m1.ts:745-860` | `content/drive-recovered/` is governed: a `RECOVERY_METHODS` enum, a `recovery.json` schema (D2), md5 supersession against the drive-source manifest (D3), and a hard-coded list of 4 `RECOVERY_ENTRIES` (D1). |
| E10 | `scripts/checks/verify-show-page-m1.ts:343-345, 558` | M1 verifier fixtures use **real drive-source paths** (2. About, 3. What to expect). Those checks can only pass on a machine that has the gitignored tree. |
| E11 | `.agent/memory/project/specs/national-show-ia-alignment/goldens/m1/drive-recovery.golden.md` | This is prior art. `drive-recovered/` was created as the sanctioned committed sibling of `drive-source/`, and the sync tool never writes to it. |
| E12 | `scripts/seed-show-pages.ts:309-416` | The seed uses `createIfNotExists` and then an `ifRevisionId` patch guarded by a seed-owned hash. A seed change to `sourcePath` reaches Sanity only through this script, which writes to the production dataset. |
| E13 | local `.next/server/app/(marketing)/national-show/sa-exhibitors/page.js.nft.json` (build of 2026-09-29) | **3531 files traced.** E4's dynamic `readFileSync` makes Next trace the whole project. That includes `content/drive-recovered/**`, and also **`content/drive-source/**` including every `source.docx` and `1. Website Development SpecificationV3/` (the password doc)** whenever the build machine has that tree. See §6. |
| E14 | `firebase.json` `hosting.frameworksBackend` | A `firebase deploy` from a local checkout is possible. It would ship E13's traced files. |

### Local replication of the linkage check

An ad-hoc script (since removed) ran the same normalisation, split and 25-character threshold against the seed bodies:

| seed section | sourcePath tree | tracked in git | linkage (sentences / missing) |
|---|---|---|---|
| 02 About the Show | drive-source | **no** | 11 / 0 |
| 03 What to Expect | drive-source | **no** | 4 / 0 |
| 04 South African Exhibitors | drive-source | **no** | 3 / 0 |
| 06 Symposium Theme | drive-recovered | yes | 1 / 0 |
| 17 (unheaded, council-draft) | drive-recovered | yes | 2 / 0 |
| 17 Frequently Asked Questions | drive-recovered | yes | 2 / 0 |

Every claim is honest: the bodies really are the council's words. Only the source files that prove it are missing from the deploy.

## 3. Affected sections

| page (pageKey) | route | section | provenance | beta today | rendered through the gate? |
|---|---|---|---|---|---|
| 04-south-african-exhibitors | `/national-show/sa-exhibitors` | South African Exhibitors | council-supplied | **false placeholder** | **yes, live and visible** |
| 02-about-the-national-show | `/national-show/about` | About the Show | council-supplied | false placeholder in the data layer | no. The route is a hand-built page (`app/(marketing)/national-show/about/page.tsx`) and does not call `loadShowPage*`. |
| 03-what-to-expect | `/national-show/what-to-expect` | What to Expect | council-supplied | false placeholder in the data layer | no. The route renders `showVisitorInfo` from Sanity directly. |
| 06-saoc-symposium | `/national-show/symposium` | Symposium Theme | council-supplied | expected clean, because the source is tracked and traced (E13) | yes |
| 17-faq | `/national-show/faq` | both sourced sections | council-draft / council-supplied | expected correct | no. The route uses `showFaqsQuery`. |

The gate is consumed only by `loadShowPageOrFallback` in six routes: international-guests, programme, sa-exhibitors, sponsors, symposium and wosa-conference.
**So one section is visibly wrong on beta today, and two more are latent.** Pages 02 and 03 would show the false notice the moment either route moves onto the gated renderer.

What remains after the fix: on `/national-show/sa-exhibitors`, the "Exhibitor Directory" section is `placeholder-ai`, so its section notice and the page-level rollup notice stay. That notice is honest. The fix removes only the false notice on the council's prose section.

**Evidence gap.** Beta sits behind the basic-auth wall, so I did not fetch it. The beta column is derived from E5, E7 and E13, not observed. The symposium "expected clean" row depends on App Hosting's build tracing `drive-recovered` the same way the local build did.

## 4. Options

| | A: relink to `content/drive-recovered/` | B: committed linkage manifest (hashes only) | C: un-ignore redacted `content.md` inside `drive-source/` | D: ship drive-source in the build only (tracing include) |
|---|---|---|---|---|
| mechanism | Copy each of the 3 `content.md` files verbatim, after a scan, into `content/drive-recovered/<NN-page>/<doc>/content.md` with a `recovery.json`. Repoint `sourcePath` in the seed and in Sanity. | A local script runs linkage against drive-source and commits `{pageKey, sectionKey, bodySha256, sourceMd5, linked:true}`. Runtime trusts the manifest when the Sanity body hash matches. | A `!content/drive-source/**/content.md` negation plus a secret-scan gate. | `outputFileTracingIncludes` on `content/drive-source/**`. |
| change to `show-pages.ts` | **none**. The root is already allowed (E1) and the linkage path is unchanged. | A new trust path in `classifySection`, which is the most sensitive function in the module. | none | none |
| linkage check | runs unchanged, on real text, at runtime | **degraded.** It becomes "the hash was asserted by whoever committed the manifest". Neither CI nor the cross-model reviewer can recompute it, because the source is absent. | unchanged | unchanged |
| secrets exposure | 3 small prose files, each scanned and hand-reviewed, in a tree that already has the C4 gate (E8). The docx is never copied. | none for source text, but a new self-attested trust root | **high.** `drive_docx_sync.py` rewrites every `content.md` from Drive, including the spec doc's. One negation and one `git add -A` re-commits the password doc. This contradicts the security comment at `.gitignore:139-144`. | **fails the brief.** App Hosting builds from git, where the files do not exist, so it fixes nothing on beta. On a local deploy it ships the password docx. |
| works on beta | yes | yes | yes | no |
| editor edits in Studio | A council edit that leaves the source text fails linkage and falls back to placeholder. That is the correct fail-closed result. | The same, but no one can see why without the manifest tool. | same as A | n/a |
| new governance | extend the existing recovery tree (E9) | a new manifest format, a generator, a staleness check and a trust model | a new partial-unignore regime | n/a |
| cost | 3 files, 3 JSON entries, verifier updates, 1 seed run | highest | low, but unsafe | low, but useless |

**Rejected:**
- **B** turns a verifiable check into an asserted one, which weakens the no-invention safeguard. It also adds a new trust root to the module that has already had three Codex-found holes (E2/E3 comments).
- **C** puts a hole in the one wholesale ignore that exists because of a real leak.
- **D** does not work on beta.

## 5. Recommendation: Option A, plus two hardening items

### A. Relink the three sections to the tracked recovery tree

1. **New recovery entries**, from the *latest* drive-source version of each document. v1.1 `content.md` is byte-identical to v1.0 for 02 and 03, but only the v1.1 docx md5 is current:

   | new dir | from | sourceMd5 (latest manifest) |
   |---|---|---|
   | `content/drive-recovered/02-about-the-national-show/about/` | `National Show/2. About/2.1 About - 2027 National Show/v1.1/content.md` | `8b34c9c8820ec0a3bbe98f0ec773cb64` (corrected 2026-10-16: `77c92cbb…` is the v1.0 md5) |
   | `content/drive-recovered/03-what-to-expect/what-to-expect/` | `National Show/3. What to expect/3.1 Info - What to Expect/v1.1/content.md` | `5deb485875e5e4adb9e76c7a08bb3a89` |
   | `content/drive-recovered/04-south-african-exhibitors/sa-exhibitors/` | `National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/v1.0/content.md` | `a7495d2bdc8d6726da2f103065affcdf` |

   - `content.md` is a byte-for-byte copy. No editing and no "cleanup", per the no-invention rule.
   - `recovery.json` follows the D2 schema. The `method` is a new enum value, `drive-source-content-md-copy`: the docx is intact, and the file was copied because the source tree is gitignored for secrets. Its `note` says exactly that.
2. **Seeds.** In `content/show-pages/{02,03,04}-*.json`, change `sourcePath` only. Leave body, heading and provenance untouched.
3. **Sanity.** Run `scripts/seed-show-pages.ts` against production. This is a production data write, so it needs operator confirmation (DECISION NEEDED 2). The seed's hash guard (E12) means a Studio-edited doc will not be overwritten. The run must report "patched" for all 3 pages and must not report "skipped, editor-owned".
4. **Verifier upkeep** (`scripts/checks/verify-show-page-m1.ts`):
   - add the 3 entries to `RECOVERY_ENTRIES` and the new method to `RECOVERY_METHODS`, and change D1's "all 4" text;
   - repoint the E10 fixtures (l.343-345, l.558) from drive-source paths to the new drive-recovered paths, so M1 passes on a clean clone;
   - check how `findManifestByOriginalName` (l.894) picks between v1.0 and v1.1 manifests. It returns the first `manifest.json` it walks to, so D3 could compare against the stale v1.0 md5. Make it prefer the highest version.

### H1. Close the trace leak (E13/E14), defense in depth

Add `outputFileTracingExcludes: { '*': ['content/drive-source/**', '**/*.docx'] }` to `next.config.ts`.
Also add an explicit `outputFileTracingIncludes` for `content/drive-recovered/**/content.md` on the six gated routes.
Then the files the gate needs are shipped because we said so, not because tracing happened to grab the whole project.
This is independent of option A, but it belongs to the same boundary, and it is a latent leak of the exact password doc.

### H2. Strengthen the secret scan on the recovery tree

The C4 regex (`verify-show-page-m3.ts:311`) needs `label: value` or `label=value`.
**It returns 0 matches on the spec doc's `content.md`, which is the file that actually leaked** (a grep finds one "password" mention there). So C4 would not have caught the original incident's shape.
For the recovery tree only, add a stricter scan.

**What the stricter scan must catch:**
- any line containing `password`, `pwd` or `passw` in any separator form;
- an email address followed within the same line or table row by a non-whitespace token;
- the md5 or path of the spec doc anywhere in `drive-recovered`.

**On failure,** it names the file and line number and never prints the match.
`gitleaks`, `trufflehog` and `detect-secrets` are not installed (checked). This is a small project script, not a new dependency, unless the operator prefers adding gitleaks (DECISION NEEDED 3).

**Pre-copy scan result (done for this spec):** the 3 candidate files score 0 on the C4 regex and 0 on the broad `password|pwd|secret|token|api key|email-address` pattern.

## 6. Secrets-boundary analysis

| asset | today | after A + H1 + H2 |
|---|---|---|
| spec doc (`1. Website Development SpecificationV3`) | gitignored. **Traced into `.next/server/**.nft.json` on local builds** (E13). Shipped by any local `firebase deploy` (E14). | gitignored and excluded from tracing. Never copied into drive-recovered. H2 blocks its md5 and path there. |
| any `source.docx` | gitignored (l.121, l.144). Traced on local builds. | gitignored, and excluded from tracing by `**/*.docx` |
| 3 page-copy `content.md` files | local only | committed in drive-recovered after the H2 scan and a human read. The text is already public: it is rendered on beta, so committing it reveals nothing new. |
| `content/drive-source/` ignore rule | wholesale | **unchanged.** No negation is added. |

The key property: the files option A commits contain only text that the site already publishes on the page, because the linkage check requires the body to occur in the source.
The rest of each `content.md` is page copy from the same council document. A human reads each file in full before commit (test T1), not just the scan.

## 7. Test strategy

| id | proves | how |
|---|---|---|
| T1 | the 3 copies are byte-identical to the drive-source originals | `cmp` against the source path named in each `recovery.json`, locally. Then a full human read of each file. |
| T2 | no secrets in the recovery tree | C4 plus the H2 scan, both exit 0. A synthetic fixture holding `Password  hunter2` and `user@x.co.za  hunter2` makes H2 exit non-zero (red-first). |
| T3 | linkage works without drive-source | **On a clean clone of the branch** (no `content/drive-source/`), call `resolveNotice()` for each of the 3 seed sections with its seed body. Expected: `null` (clean) for all 3. This is the beta condition reproduced, and it is the test that fails today. |
| T4 | fail-closed still holds | Same clean clone. Each of the 3 sections with one sentence altered gives the placeholder notice. A `council-supplied` section whose sourcePath points into drive-source gives the placeholder notice. |
| T5 | no sensitive file is traced | after `next build`, no `*.nft.json` under `.next/` lists `content/drive-source/` or any `.docx`, and the six gated routes list the drive-recovered `content.md` files. Build with `content/drive-source/` present, because that is the leak condition. |
| T6 | M1, M3 and M4 verifiers are green on a clean clone | `verify-show-page-m1.ts`, `-m3.ts` and `-m4.ts` all pass without drive-source. |
| T7 | live | After the seed run and deploy: `/national-show/sa-exhibitors` on beta (authenticated) shows no notice on the "South African Exhibitors" section and still shows one on "Exhibitor Directory". Desktop and phone screenshots. `/national-show/symposium` is unchanged. |
| T8 | Sanity doc state | A GROQ read of the 3 `showPage` docs shows `sourcePath` under `content/drive-recovered/`. |

## 8. DECISION NEEDED

1. **Approve option A as the fix.** Recommended. The alternative, option B, keeps zero source text in the repo but makes the linkage check unverifiable in CI and review. My recommendation is A, because the committed text is already on the public page.
2. **Production Sanity write.** Running `scripts/seed-show-pages.ts` against dataset `production` (project `26yfbug4`) patches `sourcePath` on 3 `showPage` docs, and nothing else changes. Recommend yes, once T1-T6 are green. The alternative is a Studio edit by hand.
3. **Secret scanner for H2.** I recommend a small project script with no new dependency. The alternative is adding `gitleaks` to the toolchain, which is stronger but is a new dependency and needs CI wiring.
4. **H1 scope.** It is a separate risk the investigation found: the password doc is traced into local builds. I recommend including it in this mission, since it guards the same boundary. The alternative is a separate P1.
5. **Deploy target.** Does the fix go out through the normal SAOC flow ("keep it local till approved, then push to beta")? Assumed yes. This spec does not push.

## 9. Out of scope

- Moving `/national-show/about`, `/what-to-expect` or `/faq` onto the gated renderer.
- Any copy change. The bodies stay exactly as seeded.
- Renaming anything in Lee-Ann's Drive.
- Changes to `execution/drive_docx_sync.py`, which is harness-owned.

## 10. Approval, F3 decisions and the production write record (2026-10-16)

**Approved:** Option A, by the SAOC lead on 2026-10-16, under authority Brad delegated that day. The lead's four binding conditions are quoted verbatim in `goldens/f3-recovery.md` §1. The contract is `contract-f3.yaml`.

**What changed from §5 when F3 was designed:**
- **The copy is a trimmed, verbatim extract, not a whole-file copy** (condition 1). 04's `content.md` also holds Lee-Ann's working notes and the blank Vendor Registration Form. 03's holds paragraphs and a sentence tail that the section does not quote. Only the source spans the section body quotes are committed, each byte-identical to the source. The method is `drive-source-verbatim-extract`. See `goldens/f3-recovery.md` §2–3.
- **The write cannot be a plain seed run.** `decideSectionAction` Rule 1 never writes a council-supplied section, and a full run reconciles every page. It goes through a new additions-only `--relink-sources` mode of `scripts/seed-show-pages.ts`, with a dry run first, `ifRevisionId` and the single field `sections[_key=="…"].sourcePath`. See `goldens/f3-recovery.md` §4(c).
- **The 02 md5 in §5 was wrong.** It is now `8b34c9c8…` (v1.1). `77c92cbb…` was v1.0.

**Finding: duplicate legacy documents.** The production dataset holds **26** showPage documents: 13 `showPage-<pageKey>` (hyphen) and 13 legacy `showPage.<pageKey>` (dot) with identical content.
- The site reads anonymously with `perspective: 'published'`. The dataset's public grant `_id in path("*")` matches a single path segment, so the dot-ids are invisible to it and `loadShowPage` sees one document per pageKey (A14 asserts this).
- A token-authenticated read, for example draft mode or Studio preview, would see both, and `loadShowPage` would throw on the duplicate.
- F3 neither reads nor writes the dot-ids, and A13 proves they stay byte-identical.
- **DECISION NEEDED (separate from F3):** delete the 13 dot-id documents. I recommend it, because they are stale duplicates that make a token read throw. The alternative is to leave them and document the trap.

### Before (read-only probe, 2026-10-16, raw perspective)

| document | section `_key` | `_rev` | sourcePath |
|---|---|---|---|
| `showPage-02-about-the-national-show` | `02-about-the-national-show--overview` | `yrV5Ly6bPYGOSmyCIyQQgc` | `content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md` |
| `showPage-03-what-to-expect` | `03-what-to-expect--overview` | `yrV5Ly6bPYGOSmyCIyQQmo` | `content/drive-source/National Show/3. What to expect/3.1 Info - What to Expect/v1.0/content.md` |
| `showPage-04-south-african-exhibitors` | `04-south-african-exhibitors--overview` | `yrV5Ly6bPYGOSmyCIyQQry` | `content/drive-source/National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/v1.0/content.md` |

Live bodies equal the seed bodies (text-compared). Every other field is in the `before.json` snapshot taken by `check-relink-live.mjs snapshot` immediately before the apply.

### After (paste the three before→after lines that `check-relink-live.mjs verify` prints, A13 / A15)

Applied 2026-10-16 as one Sanity transaction (`--relink-sources --apply`, after Codex QA round 2 PASS). `check-relink-live.mjs verify` output:

```
showPage-02-about-the-national-show/overview: rev yrV5Ly6bPYGOSmyCIyQQgc -> lwovfYlwNcvzYkZ0ey6yrT; sourcePath content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md -> content/drive-recovered/02-about-the-national-show/about/content.md
showPage-03-what-to-expect/overview: rev yrV5Ly6bPYGOSmyCIyQQmo -> lwovfYlwNcvzYkZ0ey6yrT; sourcePath content/drive-source/National Show/3. What to expect/3.1 Info - What to Expect/v1.0/content.md -> content/drive-recovered/03-what-to-expect/what-to-expect/content.md
showPage-04-south-african-exhibitors/overview: rev yrV5Ly6bPYGOSmyCIyQQry -> lwovfYlwNcvzYkZ0ey6yrT; sourcePath content/drive-source/National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/v1.0/content.md -> content/drive-recovered/04-south-african-exhibitors/sa-exhibitors/content.md
PASS: 26 showPage documents unchanged except the 3 pinned sourcePath values
```

A14 (live, published, anonymous): 13 pages match the pinned notice matrix; 6 gated routes covered; 6 negative cases hold.

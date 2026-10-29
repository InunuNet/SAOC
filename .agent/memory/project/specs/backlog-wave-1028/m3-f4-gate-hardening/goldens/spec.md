# m3-f4-gate-hardening: specification for @dev

Slug `backlog-wave-2026-10-28`, features F4a, F4b, F4c. Repo facts below were verified on origin/main `ada42c41` (worktree `.tmp/sandbox/wt-gate-hardening`, branch `chore/gate-hardening-f4`). No product code changes: A21 pins `proxy.ts`, `sanity/lib/fetch.ts`, `app/api/tickets`, the ticket page, and the three loader files byte-identical to origin/main. No UI. NO INVENTION: do not add copy, routes or slugs.

## Findings that change the brief (read first)

1. The triad linter IS wired into the gate. `execution/contract.py:858-1050` (`_run_triad_coverage_preflight`, called from `gate_cmd`) runs `execution/verify_triad_coverage.py` before any assertion and exits 6 (`TRIAD_ENFORCEMENT_EXIT_CODE`) for a non-grandfathered UI/workflow contract missing a triad kind. `CLAUDE.md` "Verification triad gate" ("not yet wired into any gate path") is stale (backlog line 152 tracks that). Consequence: F4c widens what the gate blocks, so it carries a measured blast radius (below). Do not edit CLAUDE.md in this feature.
2. `lib/data/admission-availability.ts:70` reads `ticketTypesByPoolQuery` without `live` (capacity-pool siblings, used for the sold-out display). It is on the buy page's path through `getAdmissionSoldOutBySlug`, but the same function also serves the hub via `loadTicketCardViewModels` (`:215`), so making it live raises hub Sanity volume; checkout re-reads live. It is therefore allow-listed in the manifest with a written reason, not changed. DECISION NEEDED for the team lead, my recommendation: leave it cached (60 s on sold-out display only); the alternative is a `{ live }` option threaded through `getAdmissionSoldOutBySlug`, one more product edit and a hub-volume re-measure.
3. `verify_triad_coverage.py` ownership: it is SAOC's own file. It is absent from the Athanor checkout (`/Users/vetus/ai/Athanor/execution/`, and `contract.py` there contains no "triad"), it was authored here (commits 6615513a, f8c8dd7a, aa2f74f3), and `.agent/no-update` pins only `execution/contract.py`. One nuance: `.agent/update-manifest.yaml:12` classifies the whole `execution/` prefix as HARNESS, so the manifest does claim it by prefix; an update only removes files Athanor itself shipped (`update_template.py:1874-1906`), so it is safe in practice. It is edited here in place, no `--force-path`, no `enforcement_edits` needed (the floor protects `execution/hooks/*`, not `execution/`). If an edit is unexpectedly blocked, stop and report; do not route around.
4. `execution/checks/verify_f2_baseline_completeness.py` is already red on origin/main (three `contracts/*.yaml` not baselined: saoc-seo-polish, saoc-societies-footer, security-hardening). Pre-existing, unrelated, deliberately not an assertion here. F4c adds zero new entries to that list (measured: 0 of 106 contracts/*.yaml flip).

## F4a. Pin the buy-path live reads

Two layers, because the null Sanity stub cannot reach every call site at runtime.

### Layer 1: AST check `scripts/checks/buy-path-live-reads.mts`

Run with `pnpm exec tsx scripts/checks/buy-path-live-reads.mts [--root <dir>]`. `--root` (default repo root) is the directory the manifest's relative paths resolve against; the mutation helper points it at sandbox copies. Parse with the TypeScript compiler API (`typescript` is a devDependency), not regex: it must survive reformatting, comments and multi-line calls.

Manifest: `goldens/buy-path-live-reads.json` (read it from the spec dir by path, `--manifest <path>` optional override). Rules:
1. In every file of `files_every_sanityfetch_must_be_live`, every call expression `sanityFetch(...)` must have an object-literal argument with a `live` property whose initialiser is the literal `true` or the identifier `live` (shorthand `live,` counts). Anything else (absent, `false`, spread, computed) is a violation, except a call whose `query` property is an identifier listed in `allow_not_live` for that file.
2. For each `callers_must_pass_live_true` entry, every call to the named function in that file must pass an object literal containing `live: true`.
3. `minimum_sites_found`: if a file yields fewer matched calls of a kind than listed, exit 2 (setup), never 0. This stops a renamed import turning the check vacuous.
4. A direct `client.fetch(` in a covered file is a violation (the page loaders must go through `sanityFetch`, `docs/sanity-request-volume.md`).
Output: one `VIOLATION <relative file>:<line> <callee> <reason>` line per problem, and `ok <n> sites` on success. Exit 0 clean, 1 violations, 2 setup. GET-free, no network, no Next build needed.

Dodge rules (QA found each of these exiting 0 on the first implementation, 2026-10-29; mutations D1-D6 in the manifest pin them, all must exit 1 and name the file, not exit 2):
5. Resolve imports of the sanityFetch module (any specifier ending `sanity/lib/fetch`, alias or relative): `import { sanityFetch as sf }` and `import * as sx` then `sx.sanityFetch(...)` are the same callee as `sanityFetch`, so a missing `live` on them is a violation at the call site, never a setup error.
6. Flag any non-call reference to the resolved sanityFetch binding in a covered file (`const w = sanityFetch`, passing it as an argument, storing it in an object or array) as a violation with its own message: the checker cannot follow it, so it is not allowed.
7. The `live` identifier counts only when it resolves to a PARAMETER of the enclosing function (as in `loadTicketCardViewModels({ live = false })`). A local `const live = false`, an outer variable or an import named `live` is a violation, written `live,` or `live: live`.
8. Any `.fetch(` call whose receiver resolves to a binding imported from a Sanity client module (any specifier ending `sanity/lib/client`, under any local name) or created in the file with `createClient` is a violation, in addition to the literal receiver `client` in rule 4.

Mutation proof: `checks/mutate_live_reads.py` (already written, do not edit) applies M1-M9 and D1-D6 to sandbox copies and requires exit 1 plus the mutated file named in the output, with an unmutated control at exit 0. M3 and M6-M8 are the sites the runtime layer cannot reach.

### Layer 2: behavioural `node scripts/checks/sanity-request-count.mjs --live-reads`

Add a mode to `MODES` in `scripts/checks/sanity-request-count.mjs` and a `linesSince(countLog, before)` helper in `scripts/checks/lib/local-next-server.mjs` (returns the count-log lines appended since a line count). Parameters in `goldens/live-reads-behaviour.json`. Procedure: `startServer({launched: true})`, `countedGet` the NOS host path twice. Assert the first status is the golden's `expected_status` (404, the stub returns null), that the SECOND request's new log lines contain every `second_request_must_contain` fingerprint, and none of `second_request_must_not_contain`. The not-contain entry is a positive control: `ticketsPageQuery` is the one non-live read and must be served from cache the second time, so the check demonstrably tells live from cached. Print each fingerprint with its count. Requires a prior `--build` of the same source revision (same as `--assert`; reuse `BUILD_STAMP`/`sourceRevision()`).

Verify the golden's fingerprints against the real log lines before relying on them (`sanity-count-preload.mjs` writes the decoded, whitespace-collapsed first 90 characters of the query string); if a fingerprint does not appear on the first request, fix the fingerprint and say so in the dev result, do not weaken the assertion.

QA protocol (not a gate assertion, a rebuild is minutes): remove `live: true` at page.tsx:108, then :109, then ticket-type-lookup.ts; each must turn `--live-reads` red after a rebuild.

### Probe: `/tickets/[slug]` in `cache-headers-probe.mjs --spawn`

In `goldens`-referenced file `.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json` (edit in place; the F3 contract only runs `--selftest`/`--spawn` against it) add to `routes.dynamic`: `{"host": "nos", "path": "/tickets/no-such-ticket-f4", "status": 404}`. Extend `plannedRoutes`/`spawnMode`/`liveMode` so a route may carry `status` (default 200) and the 200 check becomes `response.status !== (route.status ?? 200)`. A 404 is the only possible answer under the stub and for a slug that exists nowhere, and the no-store class still applies to it (`force-dynamic`). Do not invent a real ticket slug. In `--live` the same unknown slug is used; walled mode already applies `private, no-store, max-age=0` to every response.

### Where it runs (CI)

Verified: `.github/workflows/ci.yml` (jobs `build`, `dataset-residue-guard`, `live-write-guard`, `firestore-residue-guard`) runs lint, type-check, build, Playwright e2e and the contract-inventory ratchet; it does NOT run anything under `scripts/checks`. `contracts/checks/_shared/run_contract_suite.mjs --check-ratchet` only counts missing scripts and unparseable contracts, it executes no assertion. The step "Contract-check inventory ratchet" comment says so itself. `main` has no branch protection (CI comment), so a red CI step is detection, not a block; the block is the contract gate (A1-A8 of this contract), which is why both exist.

Add to the `build` job:
- after "Type check": `pnpm exec tsx scripts/checks/buy-path-live-reads.mts` and `node scripts/checks/cache-headers-probe.mjs --selftest` (both need only checkout and install).
- after "Build": `node scripts/checks/sanity-request-count.mjs --live-reads` and `node scripts/checks/cache-headers-probe.mjs --spawn`.
The second pair reuses the CI `.next` only if it works with CI's build env (`NEXT_PUBLIC_SAOC_SITE_URL=https://beta.saoc.co.za`, `NEXT_PUBLIC_NOS_SITE_URL=https://nos.saoc.co.za`, real `NEXT_PUBLIC_SANITY_PROJECT_ID`), because the harness's stub sets localhost origins at runtime and Next may have inlined the build-time values, which would break `nos.localhost` host routing. Measure it: build locally with exactly CI's env, then run both. If they pass, use the shared build. If host routing breaks or the stamp mismatches, give the step its own `node scripts/checks/sanity-request-count.mjs --build` first (costs a second build) and say which in the dev result. Do not mark the steps `continue-on-error`.

## F4b. Static asset caching in the probe

Fact base (verified): `proxy.ts:185` lists `/_next` as host-neutral for routing, but the wall still applies to it: `proxy()` (`proxy.ts:285-322`) authenticates every path, then `applyWallHeaders` sets `Cache-Control: private, no-store, max-age=0` on every response while `!publiclyLaunched` (`proxy.ts:72-79`). `docs/beta-password-wall.md:200-208` records this as a known cost. So:
- walled: an authenticated `/_next/static/...` GET returns `private, no-store, max-age=0` and never `immutable`.
- launched: Next's own long-lived header returns, expected `public, max-age=31536000, immutable`.

Changes to `cache-header-expectations.json`:
- `modes.launched.static`: `{"must_match": "^public, max-age=31536000, immutable$", "must_not_match": "no-store|private|s-maxage"}`.
- `modes.walled.all.must_not_match`: `public|s-maxage|immutable` (the walled rule is shared by every class, so static is covered).
- `routes.static`: `[{"host": "saoc", "discover_from": "/", "ext": "css"}, {"host": "saoc", "discover_from": "/", "ext": "js"}, {"host": "nos", "discover_from": "/", "ext": "css"}, {"host": "nos", "discover_from": "/", "ext": "js"}]`.
- `selftest_vectors` (add all): launched/static `public, max-age=31536000, immutable` pass; `public, max-age=31536000` fail; `private, no-cache, no-store, max-age=0, must-revalidate` fail; `s-maxage=60, stale-while-revalidate=31535940` fail; null fail; walled/static `private, no-store, max-age=0` pass; walled/static `public, max-age=31536000, immutable` fail.

Probe changes: `plannedRoutes` returns static entries (class `static`) in both modes. A static entry has no fixed path: fetch `discover_from` (with Basic Auth in `--live`), take the first `/_next/static/[^"' <>\\]+\.<ext>` URL from the HTML, then probe that. If none is found the route FAILS with `no /_next/static <ext> asset found in <discover_from>`; never skip silently. `--spawn` verifies the launched rule, `--live --mode walled` the walled one, `--live --mode launched` (after `SITE_PUBLIC_LAUNCH`) the launched one. Run `--spawn` and confirm Next 16 emits exactly `public, max-age=31536000, immutable`; if the real string differs (for example attribute order), record the observed string in the dev result and correct the regex to it, nothing looser than the exact observed value plus `immutable`.

## F4c. Triad classifier no longer dodgeable by URL-shaped assertions

Change only `execution/verify_triad_coverage.py` (plus the docstring and `docs/verification-triad-gate.md`). Keep the exit-code contract and the `EXEMPT:`/`PASS:`/`FAIL:` leading tokens (`contract.py` prints them verbatim; nothing parses the rest).

Add a compiled, case-insensitive module constant, named, next to `APP_PATH_PATTERN`:

`https?://(?:[^\s/@]+@)?(?:[a-z0-9-]+\.)*saoc\.co\.za(?=\.?(?:[^a-z0-9.@-]|$))`

The terminator is a non-hostname-character boundary, not an allow-list of punctuation: after `saoc.co.za` (and at most one trailing `.`) the next character must not be a letter, digit, `.`, `-` or `@`, or the text must end. That stops `saoc.co.za.evil.com`, `saoc.co.za-evil.com`, `saoc.co.zaxyz` and `https://saoc.co.za@evil.com/` (saoc.co.za as userinfo) while accepting `;`, `|`, `&`, a backtick, `]`, `}`, `,`, `>`, quotes, `:port`, `/` and end of string. Optional userinfo is allowed before the host, so `https://user@saoc.co.za/x` and `https://evil.com@saoc.co.za/` (real host saoc.co.za) classify as the deployed site. QA found the first version's allow-list lookahead missed all of these (2026-10-29); fixtures `term-*.yaml`, `userinfo*.yaml`, `trailing-dot.yaml` and the negatives `lookalike-hyphen`, `lookalike-dot-com`, `userinfo-reversed`, `path-decoy` pin it. Re-measure the blast radius with the final pattern on both sets and restate the numbers in the dev result; if either set changes from the figures below, stop and report before adding any baseline entry.

`is_ui_workflow_contract` returns True when ANY assertion text field (`command`, `cmd`, `target`, nested `verify.cmd`/`verify.target`: the existing `assertion_text_fields`) matches `APP_PATH_PATTERN` OR this deployed-site URL pattern. `description` stays unscanned. Update the FAIL/PASS/EXEMPT message text to say "an app/ path or a deployed-site URL". Rewrite the "Known limitations" docstring block honestly: the URL false negative is closed for literal `saoc.co.za` URLs; still not detected are URLs built from shell/env variables (`"$SITE_URL/x"`), `localhost` URLs, and sites reached through a helper script. Do not widen further.

Consistency with backlog line 826: the linter only checks which kinds are DECLARED. `required: false` triad assertions satisfy it today and must keep doing so; the fix must not look at `required`. Fixture `url-with-all-triad-nonrequired.yaml` pins this. The linter is not wired anywhere new; the existing preflight in `contract.py` is untouched (`contract.py` is HARNESS, pinned in `.agent/no-update`, and A20 pins it unchanged).

Measured blast radius of this exact pattern on origin/main (`python3` over 106 `contracts/*.yaml` and 302 `.agent/memory/project/specs/**/contract*.yaml`): `contracts/`: 0 reclassify. `specs/`: 2 reclassify, one already complies (`council-1028/council-design-1/contract.yaml`), one would now be blocked if re-gated (`show-dates-23-26-sept-2027/contract-m1.yaml`, a finished mission). Neither is baselined (a finished mission is not re-gated); the dev result must restate the numbers after the change. If the numbers differ from these, stop and report before adding any baseline entry.

Fixtures and expected exit codes: `goldens/triad-classifier-cases.json` (fixtures in `goldens/fixtures/triad/`). Runner `checks/run_triad_cases.py` (written, do not edit). On origin/main the six URL cases return 0 and fail; after the fix all pass.

## Docs

- `docs/sanity-request-volume.md`: delete the "QA L1" open item, list the AST check and `--live-reads` under Probes, and the CI placement.
- `docs/launch-checklist.md:199`: extend the cache-header item to say static chunks must be `public, max-age=31536000, immutable` once launched (and `private, no-store` while walled).
- `docs/verification-triad-gate.md:253-260`: replace the "trivially dodgeable" known-gap with the new behaviour and the remaining limits.

## Codex wrapper diagnosis

Not a feature item. HARNESS-owned, so no fix is specified; issue text is `goldens/upstream-codex-wrapper-issue.md` for the team lead to file. A22 only checks the file exists.

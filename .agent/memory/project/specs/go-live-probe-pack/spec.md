# go-live-probe-pack (lane B, feature B1)

Request (SAOC lead for Brad): immutable cache headers, no "[Testing only]" title, #ticket-wosa anchor, /tickets/[slug] no-store, admin routes in the probe table; `cache-headers-probe` prints a FAIL line with the observed status. No copy changes, hero frozen. Base: origin/main 5a29e41c.

## Decision: probe-only, no product code

Grep result per item:
- Immutable headers: already a `static` class in `cache-header-expectations.json` (`^public, max-age=31536000, immutable$`, CSS and JS, both hosts). Nothing to add; the new mutants prove a regression is caught.
- `/tickets/[slug]` no-store: `app/(nos)/tickets/[slug]/page.tsx:38` is `force-dynamic`, and the table already has `/tickets/no-such-ticket-f4` (404, dynamic class). No gap. Local replay-mode 500 on that row is a missing ticketType-by-slug fixture (SAOC owns fixtures); CI reads live and passes. The new FAIL line will now show `status=500` for it, which makes that locally legible.
- `#ticket-wosa`: `components/tickets/keepsake/TicketCard.tsx:145` emits `id="ticket-${productId}"`, and `wosa` is in `PROGRAMME_PRODUCTS`, rendered by `app/(nos)/national-show/tickets/page.tsx` (served as NOS `/tickets`). Anchor exists when ticket data loads. Under the CI Sanity stub no cards render, so the anchor can only be asserted against a live host: `--live` only; CI gets a static source check instead.
- `[Testing only]` title: `TICKETING_TEST_TITLE_PREFIX` in `lib/ticketing-test-metadata.ts` is deliberately on while `TICKETING_PAYMENTS_LIVE` is `false` in `lib/ticketing-test-mode.ts:7`. Not touched.
- Admin: unauthenticated behaviour read from code (see fragment golden). One conditional product risk, H2 below.

## How the probe knows the mode (title check)

`readPaymentsMode()` in the probe reads `lib/ticketing-test-mode.ts` as text and matches `TICKETING_PAYMENTS_LIVE\s*=\s*(true|false)`. Zero or multiple matches throws, giving exit 2 (setup error), never a default. `false` gives `testing`, `true` gives `live`. `--live` accepts `--payments testing|live` to override, for probing a deployed build that differs from the checked-out tree (any other value is exit 2).
- payments=testing: print `SKIP title ... payments=testing`, no assertion. Cannot fail today.
- payments=live: FAIL if `<title>` is absent or contains the prefix. A missing title never passes. Cannot pass falsely because the source constant is the same switch that renders the prefix.
Because the constant is `false` on main, CI `--spawn` prints SKIP today and starts asserting automatically the commit the constant flips.

## Where each check runs

| check | CI `--selftest` | CI `--spawn` | pre-go-live `--live` |
|---|---|---|---|
| FAIL line + observed status | vectors (offline) | every row | every row |
| admin rows in table | n/a | yes (local build, no prod) | yes |
| immutable static | existing vectors | existing rows | existing rows |
| title prefix | vectors | SKIP until constant flips | per `--payments` |
| `#ticket-wosa` anchor | vectors | not run (stub has no cards) | yes |
| anchor source check | n/a | contract assertion (static grep) | n/a |
CI never contacts prod. `--live` exits 77 (skip) without `BETA_BASIC_AUTH_*`, unchanged.

## Admin rows (unauthenticated, from code)

`/admin`, `/admin/door`, `/admin/vendors`, `/admin/tickets`: 307 (shell layout `redirect('/admin/login')`). `/api/admin/whoami`: 401 with `Cache-Control: no-store`. `/api/admin/export-csv`: 401 (route sets no header itself). Class `dynamic` (must match `no-store`, must not match `s-maxage`) in launched mode; walled mode keeps its `all` rule. `/admin/login` and POST-only `/api/admin/checkin` excluded. Dev confirms observed values locally; any change to a row records the observed value in the PR.

## Hunk list

- H1 `scripts/checks/cache-headers-probe.mjs`: pure `verdictLine(route, mode, response)` replacing the `status && report` form in `probeRoute`, FAIL line `FAIL <host> <path> class=<c> status=<n> expected=<n> cache-control=<v>`; `readPaymentsMode`, `titleVerdict`, `anchorVerdict`; admin routes joined in `plannedRoutes`; `page_checks` run; selftest runs status/title/anchor vectors and exits 1 on any WRONG. Lead's note: probe-only.
- H2 (conditional, product): if the local `--spawn` run shows `/api/admin/export-csv` 401 without `no-store`, add `headers: { 'Cache-Control': 'no-store' }` to its 401/403 `Response` in `app/api/admin/export-csv/route.ts`. Not copy. Otherwise H2 does not exist. Not shared-lane, but `app/api/admin/**` is floor-listed for reads in this harness, so the dev may need the lead to route it.
- H3 `cache-header-expectations.json`: merge `routes_admin` into `routes.admin`, add `page_checks`, `status_vectors`, `title_vectors`, `anchor_vectors` from the fragment golden.
- H4 `.agent/memory/project/specs/go-live-probe-pack/mutant-patches.json`: one patch per mutant id for `run-mutants.mjs`.
- H5 `docs/` one short section (docs/ops, name chosen by @docs) on running `--live --payments live` pre-go-live. No CI file edit is needed: existing `--selftest` and `--spawn` steps pick everything up.
Shared-lane: none, unless H2 fires (touches the admin API surface; other lanes own admin work).

## Risks
Dev must not reorder PASS output (existing text kept verbatim). Admin `get()` returns the raw 307, so the probe must not follow redirects (it does not). SPAWN port 3219 unchanged.

## Amendment 2026-11-01: SAOC authoritative scope (replaces conflicting parts above)
Files in scope: scripts/checks/ and docs/launch-checklist.md (H5 targets that file, not a new doc).
- (a) Immutable on /_next/static under launch: `--spawn` already runs `startServer({ launched: true })`, which sets SITE_PUBLIC_LAUNCH=true in the LOCAL child env only (local-next-server.mjs:95), and the `static` rows (css and js, both hosts) assert `^public, max-age=31536000, immutable$`. Nothing deployed is ever set; `--live` sends GET only. Contract A13/A14 pin both facts.
- (b) Title scope widened: the no-prefix check covers EVERY probed HTML 200 route, not just /tickets. Treatment of test mode is unchanged: payments=testing prints SKIP per route (prefix deliberately on, cannot fail today); payments=live asserts absence and fails on a missing title.
- (c) #ticket-wosa on the tickets hub: NOS /tickets, `--live` only (see table); CI source check A8.
- (d) /tickets/[slug] no-store: the existing 404 row; a real slug has no CI stub data, so it is asserted on the 404 response and live.
- (e), (f) as specified above.

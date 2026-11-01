# ci-playwright-timeout-cache (B3)

Edit `.github/workflows/ci.yml` job `build` only. `reference-ci.diff` is a verified-passing reference; the dev may differ in names but not in the properties checked.

## Decisions
- Job `timeout-minutes: 60`. Evidence (gh run list, last 30 ci.yml runs): wall times 22-41 min; the longest successful build job step profile is Build ~34 min of ~38 min total. 60 clears the worst observed by ~45%, and still cuts the 4.4 h hang (run 40573088420) to one hour. Checker accepts 50..90.
- Install and install-deps steps `timeout-minutes: 10`. Normal install is ~18 s (run 41279995702). 10 min is ~30x normal yet 26x tighter than the hang. Checker accepts 5..20.
- Version: a step `pnpm exec playwright --version | awk '{print $2}'` exposed as a step output (lockfile pins @playwright/test 1.63.0). Key `playwright-${{ runner.os }}-<version output>`; no restore-keys, so a version bump is always a clean miss.
- Cache path `~/.cache/ms-playwright`, `actions/cache@v4` (major pin, as `actions/checkout@v4` etc.).
- Hit/miss: miss runs `playwright install --with-deps chromium`; hit runs `playwright install-deps chromium` so OS libraries (not part of the cache) still exist for e2e.
- Order: version -> cache -> install/deps -> E2E tests. Only additions to ci.yml, no existing line changed. Other jobs untouched. No copy changes.

## Proof beyond the static check
CI green on the PR (cache miss, saves). Then re-run the same workflow: the cache step reports `Cache restored`, the install-deps step runs, e2e green.

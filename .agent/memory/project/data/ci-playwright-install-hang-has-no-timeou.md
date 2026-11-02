# ci-playwright-install-hang-has-no-timeou

**CI: Playwright install hang has no timeout** (2026-10-28) — run 40573088420 (#124) sat 4.4h in "Install Playwright browsers" (`pnpm exec playwright install --with-deps chromium`), blocking the whole merge chain until cancelled+rerun by hand. Add `timeout-minutes` to that step (and the job) in .github/workflows/; consider caching ~/.cache/ms-playwright.

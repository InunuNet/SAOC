# Golden Spec — `.github/workflows/refresh-llms.yml`

Nightly GitHub Actions cron that regenerates `public/llms-full.txt` from Sanity and
auto-commits the result.

---

## Exact workflow YAML

```yaml
name: Refresh llms-full.txt

on:
  schedule:
    - cron: '0 2 * * *'   # 2am UTC = 4am SAST, nightly
  workflow_dispatch:        # manual trigger

jobs:
  refresh-llms:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Regenerate llms-full.txt
        run: pnpm refresh-llms
        env:
          NEXT_PUBLIC_SANITY_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_SANITY_PROJECT_ID }}
          NEXT_PUBLIC_SANITY_DATASET: production
          SANITY_API_TOKEN: ${{ secrets.SANITY_API_TOKEN }}

      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/llms-full.txt
          git diff --cached --quiet || git commit -m "chore: refresh llms-full.txt [skip ci]" && git push
```

---

## Notes / invariants

- `[skip ci]` in the commit message prevents an infinite workflow loop.
- `permissions: contents: write` is required for the bot push.
- The cron `0 2 * * *` (2am UTC / 4am SAST) must match contract assertion A6.
- `SANITY_API_TOKEN` must appear in the workflow (contract assertion A7).

## Required GitHub secrets

- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `SANITY_API_TOKEN`

(`GITHUB_TOKEN` is provided automatically by Actions.)

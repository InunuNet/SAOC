# A8 — GitHub Actions CI

The CI workflow (`.github/workflows/ci.yml`) runs on every push to `main` and on every pull request targeting `main`. It installs dependencies with `pnpm install --frozen-lockfile`, then runs lint, TypeScript type-check, and a full Next.js production build in sequence. Build-time Sanity environment variables are injected from GitHub Actions secrets, so the Sanity client initialises correctly during the build step. Node 20 and pnpm 9 are pinned.

## Required GitHub Secrets

Add these three secrets before merging any PR. Without them the build step will fail (Sanity client throws on missing project ID).

| Secret name | Value |
|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `26yfbug4` |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` |
| `SANITY_API_READ_TOKEN` | Token from sanity.io/manage (read below) |

### Get SANITY_API_READ_TOKEN

1. Go to [sanity.io/manage](https://www.sanity.io/manage) → project `26yfbug4`
2. **Settings → API → Tokens → Add API token**
3. Name: `CI read token` — Permission level: **Viewer**
4. Copy the token immediately (shown once)

## Add Secrets to GitHub

1. GitHub → `InunuNet/SAOC` → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add each of the three secrets above

## Verify CI is Running

After adding secrets, push any commit to `main` or open a PR targeting `main`:

```bash
gh run list --repo InunuNet/SAOC --limit 5
```

Each run should show all four steps (lint, type-check, build) completing with a green checkmark. Build logs are at **Actions → CI → [run] → ci**.

## What A8 also fixed

Two bugs surfaced during CI wiring and resolved in the same feature:

- `lib/firebase-admin.ts` — env var names corrected to `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (were mismatched, causing Admin SDK init to fail at runtime)
- `lib/sanity/client.ts` — dead file deleted (duplicate of `lib/sanity.ts`; caused TypeScript errors in CI)

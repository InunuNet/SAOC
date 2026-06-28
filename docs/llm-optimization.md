# LLM Content Refresh

## What these files are

`public/llms.txt` — curated index for LLM crawlers. Lists key routes and a brief description of each. Hand-authored; edit it intentionally.

`public/llms-full.txt` — full Markdown content dump of all public pages. Written for LLM consumption (AI assistants, search bots). **Auto-generated — do not edit by hand.**

Both files follow the emerging `llms.txt` convention for making site content accessible to language models.

## Running the refresh locally

Requires `NEXT_PUBLIC_SANITY_PROJECT_ID` set in `.env.local`. No running server needed — the script queries Sanity directly via GROQ.

```bash
pnpm refresh-llms
```

The script (`scripts/refresh-llms.ts`) queries Sanity via GROQ, assembles clean Markdown from each content type, and writes `public/llms-full.txt`. Progress and warnings go to stderr.

## How CI works

A GitHub Actions workflow (`.github/workflows/refresh-llms.yml`) runs nightly at 2am UTC (4am SAST). It:

1. Installs dependencies
2. Runs `pnpm refresh-llms` with `NEXT_PUBLIC_SANITY_PROJECT_ID` and `SANITY_API_TOKEN` from repository secrets
3. Commits any changes to `public/llms-full.txt` with the message `chore: refresh llms-full.txt [skip ci]`

The `[skip ci]` suffix in the commit message prevents an infinite workflow loop.

### Required GitHub secrets

Add these in **Settings → Secrets and variables → Actions**:

- `NEXT_PUBLIC_SANITY_PROJECT_ID` — your Sanity project ID
- `SANITY_API_TOKEN` — a Sanity read token (optional for public datasets, required for private ones)

The workflow can also be triggered manually via **Actions → Refresh llms-full.txt → Run workflow**.

## Future automation

Sanity webhook on content publish can trigger the `workflow_dispatch` endpoint to refresh immediately after edits — not yet wired up.

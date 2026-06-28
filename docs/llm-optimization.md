# LLM Content Refresh

## What these files are

`public/llms.txt` — curated index for LLM crawlers. Lists key routes and a brief description of each. Hand-authored; edit it intentionally.

`public/llms-full.txt` — full Markdown content dump of all public pages. Written for LLM consumption (AI assistants, search bots). **Auto-generated — do not edit by hand.**

Both files follow the emerging `llms.txt` convention for making site content accessible to language models.

## Running the refresh

> **Note:** Alembic blocks `localhost` hostnames by design. Run against the live production URL only.

Requires:
- Alembic proxy running on port 7077
- Site live at `https://saoc.co.za` (post-DNS-cutover)

```bash
REFRESH_BASE_URL=https://saoc.co.za pnpm refresh-llms
```

The script (`scripts/refresh-llms.ts`) crawls 7 routes through Alembic, extracts clean Markdown, and writes `public/llms-full.txt`. Progress and warnings go to stderr.

Until DNS cutover, `llms-full.txt` stays as the hand-authored version — do not run the script against localhost.

## Adding or removing pages

Edit the `PAGES` array in `scripts/refresh-llms.ts`. Each entry is `{ path: string, title: string }`. Paths are relative to `BASE_URL`.

## Future automation

Nightly refresh via GitHub Actions cron, triggered on schedule or via Sanity webhook on content publish — not yet implemented.

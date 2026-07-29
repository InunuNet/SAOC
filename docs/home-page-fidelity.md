# Home Page Fidelity — F5 Audit / F6 Fixes

Tracks the home page's fidelity to the Claude Design reference
(`design/Claude Design HTML/SAOC Website (standalone).html`): what drifted, what was
fixed, and what's still open.

- F5 (2026-07-28): drift audit, no code changes. The full write-up and screenshots lived
  in `.agent/memory/scratch/home-audit-20260728/` but were deleted during the F6 wrap-up
  and were never git-tracked — this document and `learned.md` are now the surviving record.
- F6 (2026-07-29): code fixes for 6 of the 9 audit findings, QA-PASSED. Contract:
  `contracts/f6-home-fidelity.yaml` (26 assertions, all green). The QA verdict in
  `.agent/memory/scratch/f6-qa-20260729/` was lost the same way.

## What shipped in F6

| ID | Component | Change |
|----|-----------|--------|
| D2 | `components/home/PartnersSection.tsx` | Rebuilt from a 3-column grid of cards (each with a tier badge, a description paragraph, and a hover arrow) to the reference's compact single-row `lg:grid-cols-6` band of bordered, name-only cells. This was the largest single change — the old layout was roughly 5x the reference's height and the dominant contributor to the page's overall length. |
| D3 | `components/home/YearbookStrip.tsx` | Swapped the image from `orchid-pink.jpg` to `orchid-purple.jpg` (matches the reference's dark-purple crop) and added the missing "EST. 1968" badge as an absolutely-positioned overlay on the image. |
| D5 | `components/home/MissionBlock.tsx` | Removed the `<em className="italic">` wrap around "blooms to the bench." — the reference headline is fully upright. Text is unchanged. |
| D9 | `components/home/NavCards.tsx` | Image wrapper `aspect-[3/2]` → `aspect-[4/5]`, matching the reference's portrait crop. |
| D7 | `components/chrome/UtilityBar.tsx` | Added a "Making a difference since 1968" tagline (`hidden md:flex`, mono uppercase) between the email link and the action pills, matching the reference layout. |
| D8 | `components/chrome/Footer.tsx` | "Judging" → "Judging & Awards" in the Explore nav (now matches the header nav, which already had the longer label). REG#/NPO collapsed from two wrapped `<span>` lines into one uppercase, mono-tracked line. |
| D1 (code half only) | `components/ui/EventRow.tsx` | The host-society `<span>` is now conditional on `event.host` being truthy, so an unpopulated host no longer leaves a dangling blank space next to the arrow. |
| — | `eslint.config.mjs` | Added `Old SAOC Website Backup/**` and `.agent/**` to ignores. `pnpm lint` now exits 0 — it had been failing with ~2640 errors from an untracked legacy Joomla backup directory being picked up by the linter, unrelated to F6's own files. |
| — | `package.json` / `pnpm-lock.yaml` | Added `playwright` as a devDependency, used by the rendered-output fidelity checks under `contracts/checks/f6-home-fidelity/` (see below). |

D4 (yearbook heading italics) was inspected during F6 and found to already scope correctly in
source — `<em>` wraps only "Orchids South Africa", not the full heading. No code change was
needed; it's encoded in the contract only as a regression guard (A9/A10).

## Known-open — not part of F6, do not treat as done

- **D1, content half** — 0 of 18 Sanity `societyEvent` documents have `hostSociety` populated,
  so no host label currently renders on any event row on the live site, even with the code fix
  above in place. This is a content-entry task in Sanity Studio, not a code bug. Tracked in
  `.agent/memory/project/backlog.md`.
- **D6** — the hero lede copy differs from the reference (`components/home/Hero.tsx:84-86`).
  Copy authority is unresolved (may be an intentional later revision, not drift) — deliberately
  left untouched pending a content-owner decision. Tracked in `.agent/memory/project/backlog.md`.
- **`@sanity/image-url` default-export deprecation warning** — fires on every home-page render
  in dev; pre-existing, unrelated to F6, tracked separately in backlog.
- **Mobile horizontal overflow at 375px** — pre-existing, caused by
  `components/home/ShowBand.tsx:35` (`aspect-[4/3] md:aspect-auto min-h-[400px]`). Found during
  F6 QA, confirmed to reproduce identically with all 7 F6 files reverted, so it predates F6 and
  is out of scope for it.

## Gotcha: stale `.next/cache` can hide newly-added Tailwind classes

During F6 QA, the D7 tagline (`hidden md:flex`) was present in server-rendered HTML but computed
to `display: none` at every breakpoint — a false negative that a source `grep` alone would have
missed. Root cause: a newly-introduced Tailwind utility-class combination didn't make it into
the compiled CSS bundle because `.next/cache` (the webpack/PostCSS incremental cache) had gone
stale. Neither restarting the dev server nor running `pnpm build` without first deleting `.next`
reliably invalidates it — only a full removal of `.next` does. If a class you just added doesn't
seem to be applying, clear `.next` entirely before concluding the class itself is broken.
`contracts/checks/f6-home-fidelity/_shared.mjs` documents this hazard for future checks in this
suite.

## Re-running the fidelity checks

### Contract assertions (source-level, fast)

```bash
# from contracts/f6-home-fidelity.yaml — grep/tsc/lint/build only, no browser
pnpm type-check
pnpm lint
pnpm build
```

The remaining assertions (A1–A23) are individual `grep`/`awk` checks against the 7 changed
component files — see `contracts/f6-home-fidelity.yaml` for the exact commands. They're fast but
source-level only: as the `.next/cache` gotcha above shows, a passing grep does not guarantee the
class actually renders. Treat contract-only green as necessary, not sufficient.

### Rendered-output checks (browser-level)

`contracts/checks/f6-home-fidelity/` holds Playwright-driven checks that verify computed styles
and bounding boxes against a running dev server, not just source text. As of this writing only
the shared helper (`_shared.mjs`) and one check (`utilitybar-tagline-desktop.mjs`) exist —
@architect is still building this suite out; do not treat it as a complete replacement for the
contract gate yet.

To run an individual check:

```bash
pnpm dev --port 3002   # leave running in another terminal
node contracts/checks/f6-home-fidelity/utilitybar-tagline-desktop.mjs
```

Notes:
- Checks default to `http://localhost:3002`; override with `F6_CHECK_BASE_URL`.
- They require a live dev server — they don't work against a static build.
- Don't run `pnpm build` concurrently with a check run: build and dev share `.next`, and a
  concurrent build corrupts the dev server's asset manifest.

# Reboot Context
_Generated: 2026-08-06T00:30Z — session ended on quota exhaustion (resets 4am SAST)_

## Mission: `cms-loop-and-wiring` — all 4 features' code SHIPPED, 1 verification open

| Feature | Code | Verified | Commit |
|---|---|---|---|
| F1 CDN TTL | shipped | **RELIABILITY UNPROVEN** | `82ef05f` |
| F2 event tags | shipped | blocked on F1 | (with F1) |
| F3 national-show wiring | shipped | read-only checks NOT run | `32f3b0f` |
| F4 award/province | shipped | **5/5 read-only PASS** | `19b7fa8` |

## START HERE — the one open question

**Does F1's propagation converge, or does only a rollout purge the CDN?**

Tally so far: **1 pass, 4 fails** on the 120s bound, across F6 AND F2 — different documents,
different pages, different tags. That pattern points at the feature, not the checks.

Two outcomes, opposite responses:
- **Converges at ~150-200s** → fix works, 120s bound was calibrated against a wrong model of
  `stale-while-revalidate`. Legitimate recalibration, stated openly. Likely mechanism: the CDN
  only *triggers* a background refetch on the first request after the window, so fresh content
  needs a further round trip — worst case well beyond 60s.
- **Never converges** → `revalidate = 60` does not close the loop on App Hosting. F1 needs a
  different approach and M1 fails as built.

**The decisive experiment** (was in flight when quota died): one mutation, then poll to 10+ min
recording elapsed time, `x-nextjs-cache`, `cdn-cache-status`, `age`, sentinel present y/n.
Watch `age` when the sentinel flips: **resetting to ~0 across all routes = rollout purge;
one object refreshing while others climb = genuine stale-while-revalidate.** That distinction
IS the answer.

**Do NOT recalibrate the 120s bound to manufacture a pass.** Evidence first.

Confounder: rollouts purge the CDN. F4 pushed 22:26:52Z, F3 shortly after. Any sample
overlapping a rollout is contaminated. Run in a quiet window.

## Next actions, in order

1. Run the long-poll experiment above → decide F1's fate.
2. Run F3's read-only checks against deployed: **A6 (hero visual neutrality)** first — proves
   wiring didn't change the rendered image; **A2 (home-page countdown regression)** second —
   `countdownDate` is shared with `ShowBand` and was the one field that already worked.
   Then A4, A5. (`contracts/checks/cms-loop-f3-national-show/`)
3. Once F1 is settled: run the mutating round trips (F2 A1, F3 A1/A3, F4 A1/A2). ~7min each.
4. @docs, then M1/M2/M3 gates, then close out.

## Rules that were learned the hard way this session

- **Mutating checks are EXCLUSIVE.** Never run two concurrently, never dispatch parallel agents
  that mutate the same documents. This blocked @qa once tonight.
- **Parallel @dev agents need disjoint file ownership stated in the brief** — two agents in one
  worktree both stopped, correctly, rather than ship each other's work. Cost a round trip each.
- **A running check is not a failed check.** Mutating checks take ~7min (120s propagation +
  300s cleanup). Read exit codes, never curl mid-flight — that produced a false escalation.
- **Orchestrator dispatches, never implements.** Violated once tonight; the direct edit collided
  with an architect already mid-fix on the same file with a better diagnosis.

## Athanor — DONE, do not reopen

Two PRs open upstream, out of scope now:
- **#1325** — orchestrator-discipline PreToolUse hook (warn-only; hard-block not safely possible),
  verification-harness integrity rules in `coding.md`, task-sizing guidance in `workflow.md`.
  Plus issue #1324 (`gh_closure_scan.py` frontmatter crash).
- **#1326** — `TeammateIdle` hook enforcing a report before an agent may go idle (real
  enforcement via exit 2; supersedes issue #1315), and `mission.py list` stderr noise.

Neither takes effect here until merged + `make update-template`.

## Deferred — do not attempt

- Secret rotation — single pre-launch pass, Brad's call.
- `hostSociety` assignment — needs Brad's domain knowledge.
- National Show `showDate`/host schema fields — content-model decision tied to Brad's open
  committee question on brand architecture (master brand vs rotating host sub-brand).
- Awards archive/gallery (per-show winners + photos) — separate, bigger, unscoped feature.
  F4 is NOT progress toward it.

## Open items for Brad

- `/national-show` H1 now reads "The 19th South African National Orchid Show", sitting next to a
  hardcoded "Nineteenth Edition" line — reads redundantly. Copy call, layout untouched.
- Venue now renders "Cape Town International Convention Centre" (was "CTICC, Cape Town").
  Editable in the Studio.
- Test sentinels are publicly visible ~60s after every mutating check completes. Constrains
  running these against production post-launch.
- `scripts/seed-sanity.ts`: `config({ quiet: true })` with no `path` misses `.env.local` —
  `pnpm seed` likely broken today. Backlogged.
- `firebase apphosting:rollouts:list` is not a valid CLI command and `gcloud` is not installed,
  so there is no CLI path to a rollout ID. Tooling gap.

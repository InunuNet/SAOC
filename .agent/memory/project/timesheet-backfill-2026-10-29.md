# SAOC time back-estimate (timesheet rule: 15-min gap, 5-min tail, SAST)

Transcript prompts: 459 from 2026-09-28 12:30:43+02:00 to 2026-10-29 15:03:04+02:00
Measured total: 24.7 h over 23 days

| Day | Hours | Sessions |
|---|---|---|
| 2026-09-28 | 1.21 | 6 |
| 2026-09-29 | 0.97 | 5 |
| 2026-10-03 | 0.08 | 1 |
| 2026-10-06 | 0.32 | 3 |
| 2026-10-07 | 1.25 | 4 |
| 2026-10-08 | 2.79 | 3 |
| 2026-10-13 | 1.47 | 4 |
| 2026-10-14 | 0.99 | 5 |
| 2026-10-15 | 1.97 | 9 |
| 2026-10-16 | 2.02 | 4 |
| 2026-10-17 | 0.53 | 1 |
| 2026-10-18 | 0.27 | 3 |
| 2026-10-19 | 1.22 | 6 |
| 2026-10-20 | 0.51 | 4 |
| 2026-10-21 | 0.10 | 1 |
| 2026-10-22 | 1.56 | 3 |
| 2026-10-23 | 2.84 | 8 |
| 2026-10-24 | 0.97 | 4 |
| 2026-10-25 | 0.89 | 7 |
| 2026-10-26 | 0.08 | 1 |
| 2026-10-27 | 0.42 | 4 |
| 2026-10-28 | 0.97 | 7 |
| 2026-10-29 | 1.30 | 6 |

## Git-commit days with NO transcript coverage: 98 days, 1845 commits

| Month | Days | Commits |
|---|---|---|
| 2026-04 | 2 | 4 |
| 2026-05 | 2 | 3 |
| 2026-06 | 21 | 1241 |
| 2026-07 | 31 | 83 |
| 2026-08 | 27 | 348 |
| 2026-09 | 15 | 166 |

## Estimate for the uncovered period (2026-04-21 → 2026-09-27)
- Method: transcripts before 2026-09-28 no longer exist, so the 98 commit days with no transcript are extrapolated at the measured rate from the covered period: 24.7 h / 23 active days = 1.07 h per active day.
- Uncovered estimate: 98 days × 1.07 h ≈ 105 h.
- **Back-estimate total to 2026-10-29: ≈ 130 h (24.7 h measured + ≈105 h extrapolated) ≈ R97,500 ex VAT at R750/h.**
- Caveats. This is a FLOOR:
  - The timesheet rule counts only prompt sessions (15-min gap, 5-min tail).
  - Off-keyboard work is not captured: Lee-Ann meetings and WhatsApp, Drive and doc review, browser testing, Council correspondence.
  - June (1,241 commits in 21 days) was the heaviest build stretch and is likely under-estimated by a flat per-day rate.
- Source script: .tmp/sandbox/timesheet-backfill/estimate.py. Inputs: ~/.claude/projects/-Users-vetus-ai-SAOC*/*.jsonl (SAOC, NOS Site and NOS Design sessions) plus git log dates.

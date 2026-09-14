# p1-migration-script-write-polarity-decis

**[P1] Migration script write-polarity — decision needed, not fixed overnight** (found
  2026-09-08, `ticketing-complete` overnight session). Six scripts default to WRITING to the
  live Sanity `production` dataset on a bare no-flag invocation: `scripts/fix-venue-never-
  changed-copy.ts`, `scripts/migrate-ticket-type-category.ts`, `scripts/migrate-show-sales-
  fields.ts`, `scripts/fix-vip-and-weekend-pass-pricing.ts`, `scripts/fix-show-dates-2027.ts`,
  `scripts/fix-visitor-info-dates-confirmed.ts` (all gate on
  `const DRY_RUN = process.argv.includes('--dry-run')`). `fix-vip-and-weekend-pass-
  pricing.ts:70-79` builds the write-capable client before it even reads the flag. Three other
  scripts already use the safer polarity (`--apply`-to-write): `seed-fictional-test-show.ts`,
  `seed-demo-ticket-type.ts`, `swap-active-show.ts`. Decision needed: flip the six to `--apply`
  polarity, or delete the spent ones. Deliberately NOT fixed overnight — several of the six may
  already have been run against live data, so changing them now without checking could mask
  that history. See `learned.md` 2026-09-08 entry for detail.

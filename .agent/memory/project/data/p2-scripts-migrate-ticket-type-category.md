# p2-scripts-migrate-ticket-type-category

**[P2] `scripts/migrate-ticket-type-category.ts` has only ever run `--dry-run`.** The 5 live
  admission `ticketType` docs in production Sanity still have `category: null`. A server warning logs
  for each during Admission ticket page renders (spotted during `ticketing-flow-redesign` F2 QA,
  2026-08-24). This is protected by F3's admission-only null-category read-time fallback in the GROQ
  query, so it is not urgent, but the docs should be backfilled with a real category for real
  eventually rather than relying on the fallback indefinitely. Recommend: `scripts/migrate-ticket-type-category.ts --apply`
  to clear the warning.

# 2026-10-07-qa-f1-conference-workshop-tic

(2026-10-07, QA F1 conference-workshop-tickets) Three pre-existing contract checks are stale and FAIL on HEAD independent of current work (hardcoded catalogue counts from an older snapshot): `contracts/checks/ticketing-purchase-pages-f3/check-category-assignment.mjs`, `contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs`, `contracts/checks/ticketing-conferences-and-events-f5/check-pool-data-invariant.mjs`. Update to read counts from the live exports, or retire with a note in their closed missions.

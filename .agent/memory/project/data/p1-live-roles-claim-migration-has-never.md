# p1-live-roles-claim-migration-has-never

**[P1] Live `roles`-claim migration has never been run.** `scripts/admin-migrate-roles.ts`
  is dry-run by default; no account holds a `roles` claim, including `brad@inunu.net`. Running
  `--apply` is human-gated. `app/api/admin/checkin/route.ts`'s capability check stays deliberately
  deferred until it has.

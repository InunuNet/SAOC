# Ozow account swap (test mode)

SAOC has its own Ozow merchant account. This runbook moves the app from the old test credentials
to the SAOC account's three values while staying in Ozow test mode (`IsTest=true`). It does not
go live. The three values keep their existing names: `OZOW_SANDBOX_SITE_CODE`,
`OZOW_SANDBOX_PRIVATE_KEY`, `OZOW_SANDBOX_API_KEY`.

A pasted credential that carries a trailing newline, quotes or spaces fails to authenticate (see
`docs/secret-corruption-incidents.md`). Every step below that writes a value is followed by a
step that proves it.

## Steps

1. **Local env.** Put the three values in `.env.local` (or a separate env file) as plain
   `NAME=value` lines, no quotes, no trailing spaces. Locally `lib/secrets.ts` reads them from
   `process.env`.

2. **Probe.** From the repo root:

   ```bash
   pnpm exec tsx --env-file=.env.local scripts/ops/ozow-credential-probe.mts
   ```

   It checks the shape of each value, then proves the API key and site code against Ozow's
   transaction-status endpoint, then proves the private key by posting a signed minimum-amount
   `IsTest=true` request that is never paid. It prints lengths, HTTP statuses and Ozow's response
   text, never a value. Exit codes: 0 all pass, 1 any fail, 3 inconclusive.

   - Step 2 passes only when Ozow answers the real key differently from a deliberately invalid
     key. If both get the same answer the probe reports INCONCLUSIVE.
   - Step 3 is expected to report INCONCLUSIVE. A raw (non-browser) POST to `pay.ozow.com`
     returned the same error page for a correct and a wrong hash when last tested
     (`contracts/golden/ozow-m1-f1/README.md` section 2). The private key is then proven by the
     test-mode checkout in step 5.
   - The probe may leave an abandoned test transaction in the Ozow merchant admin. Ignore it.

3. **Bundle push.** Deployed, the three values live inside the `SAOC_PAYMENT_SECRETS` JSON secret
   (`docs/secret-bundles.md`). Run this yourself in a terminal logged in to `firebase` and
   `gcloud` for project `saoc-webapp`:

   ```bash
   scripts/ops/push-ozow-keys-to-bundle.sh --dry-run .env.local   # reads only, shows names and lengths
   scripts/ops/push-ozow-keys-to-bundle.sh .env.local             # asks you to type a phrase
   ```

   The script re-checks the shape, replaces only the three keys (the PayFast keys are left
   untouched), sets the bundle exactly once, re-reads it and compares a sha256 per key, then
   destroys the previous version so one enabled version remains. It stops without destroying
   anything if verification fails.

4. **Redeploy.** App Hosting resolves secrets when a revision is created, so the running backend
   keeps the old values until a new rollout. The script prints the command; confirm the backend
   id first:

   ```bash
   firebase apphosting:backends:list --project saoc-webapp
   firebase apphosting:rollouts:create saoc-prod --project saoc-webapp --git-branch main --force
   ```

5. **Test-mode checkout on beta.** On `https://beta.saoc.co.za` run one ticket purchase through
   Ozow in test mode and let it complete. Confirm the order reaches paid, which proves the private
   key (hash on the notification) and the API key (status confirmation) end to end. If the order
   stays unpaid, check the application logs for `[payments/ozow]` lines.

## What remains for go-live

Not part of this swap. `docs/launch-checklist.md` item 6 governs it: flip `TICKETING_PAYMENTS_LIVE`
and both adapter constants in `lib/payments/sandbox-mode.ts` in one reviewed commit, turn off the
`adminSettings/ozowSandboxTestMode` admin toggle at the same deploy, purge test orders, and make
one real-money minimum purchase. The live Ozow keys are then pushed to the same bundle.

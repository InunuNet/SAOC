# Ozow account swap (test mode)

SAOC has its own Ozow merchant account. This runbook moves the app from the old test credentials
to the SAOC account's three values while staying in Ozow test mode (`IsTest=true`). It does not
go live. The three values keep their existing names: `OZOW_SANDBOX_SITE_CODE`,
`OZOW_SANDBOX_PRIVATE_KEY`, `OZOW_SANDBOX_API_KEY`.

A pasted credential that carries a trailing newline, quotes or spaces fails to authenticate (see
`docs/secret-corruption-incidents.md`). Every step below that writes a value is followed by a
step that proves it.

## Steps

1. **Local env.** Put the three values in an env file as exactly one `NAME=value` line each, LF
   line endings, no UTF-8 BOM at the start of the file, no `export`, no quotes, no spaces, no `#`,
   and only the ASCII characters `A-Z a-z 0-9 -` (invisible or non-ASCII characters such as a
   non-breaking space are refused)
   (Ozow documents no issued character set; the SAOC values are 11, 32 and 32 characters, so this
   is the conservative choice). The push script refuses anything else and names the key and the
   character class, never the value. Locally `lib/secrets.ts` reads the same names from
   `process.env`.

2. **Probe (standalone, optional).** From the repo root:

   ```bash
   pnpm exec tsx --env-file=.env.local scripts/ops/ozow-credential-probe.mts
   ```

   Caution: `--env-file` does not override a variable already exported in your shell, and Node's
   parser trims quotes and treats an unquoted `#` as a comment, so a standalone run can test
   different values from the file. Step 3's `--dry-run` runs the probe on exactly the values the
   push would write, so prefer that.

   The probe checks the shape of each value, proves the API key and site code against Ozow's
   transaction-status endpoint, then proves the private key by posting a signed minimum-amount
   `IsTest=true` request that is never paid. It prints lengths, HTTP statuses and Ozow's response
   text, never a value. Exit codes: 0 all pass, 1 any fail, 3 inconclusive. Observed Ozow behaviour:

   - Status endpoint: HTTP 404 "No transactions found" for a valid key and unknown reference;
     HTTP 401 "API key is invalid." for a bad key. PASS needs 404 (or 200) for the real key and
     401 for the control. A real 401/403 is FAIL. Any other status pair is INCONCLUSIVE.
   - Hosted page: a correct hash lands on `/<guid>/secure/`, a wrong hash on `/request-error`.
     PASS needs the correct hash not on `/request-error` and the wrong hash on it.
   - The probe may leave an abandoned test transaction in the Ozow merchant admin. Ignore it.

3. **Bundle push.** Deployed, the three values live inside the `SAOC_PAYMENT_SECRETS` JSON secret
   (`docs/secret-bundles.md`). Run this yourself in a terminal logged in to `firebase` and
   `gcloud` for project `saoc-webapp` (needs `pnpm install` for tsx):

   ```bash
   scripts/ops/push-ozow-keys-to-bundle.sh --dry-run .env.local   # probe + read-only merge summary
   scripts/ops/push-ozow-keys-to-bundle.sh .env.local             # asks you to type a phrase
   ```

   The script parses the file strictly, then runs the probe against exactly those three values
   (passed to the probe's environment, overriding anything exported in your shell) and stops
   unless the probe exits 0, before touching Secret Manager. `--dry-run` also runs the probe (real
   calls to Ozow, possibly one abandoned test transaction) and then stops before any write. A
   real run replaces only the three keys (the PayFast keys are untouched), sets the bundle exactly
   once, re-reads it and compares a sha256 per key, then destroys the previous version so one
   enabled version remains. It never destroys without a passed verification.

   If it is interrupted or fails after the set, it prints which versions to look at and the
   exact `gcloud secrets versions list` and `destroy` commands. Do not re-run it until you have
   listed versions; it refuses to start with two enabled versions.

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

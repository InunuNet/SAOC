# Secret bundles

Secret Manager gives 6 active secret versions free per billing account; every version beyond
that is US$0.06 a month, and a disabled version still counts (only a destroyed one does not).
SAOC therefore keeps all App Hosting secrets in two JSON secrets, each with ONE enabled version.

| Secret | Keys |
| --- | --- |
| `SAOC_APP_SECRETS` | `ADMIN_EMAIL_ALLOWLIST`, `BETA_BASIC_AUTH_USER`, `BETA_BASIC_AUTH_PASSWORD`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `RECONCILIATION_CRON_SECRET`, `RECOVERY_TOKEN_SECRET`, `RESEND_API_KEY`, `SANITY_API_TOKEN`, `SANITY_REVALIDATE_SECRET`, `SPEAKERS_PARTNER_PASSWORD`, `VENDOR_REGISTRATION_TOKEN_SECRET`, `VENDOR_STAND_PAYMENT_TOKEN_SECRET` |
| `SAOC_PAYMENT_SECRETS` | `OZOW_SANDBOX_SITE_CODE`, `OZOW_SANDBOX_PRIVATE_KEY`, `OZOW_SANDBOX_API_KEY`, `PAYFAST_SANDBOX_MERCHANT_ID`, `PAYFAST_SANDBOX_MERCHANT_KEY`, `PAYFAST_SANDBOX_PASSPHRASE` |

The payment bundle is separate so the go-live swap to live Ozow keys touches only that secret.

## How the app reads them

`apphosting.yaml` binds each bundle as one RUNTIME env var of the same name. `lib/secrets.ts`
parses each bundle once (cached) and exposes `getSecret(name)`, which checks the bundles and
falls back to `process.env[name]`, and `secretsEnv()` for helpers that take an env record
(payments, Speakers Partner, show pages). A malformed bundle throws at first read with a message
naming the bundle variable, never a value. Application code never reads a secret from
`process.env` directly. Local development is unchanged: `.env.local` keeps one plain variable per
secret and the two bundle variables stay unset.

## Add or rotate a value

Every `secrets:set` adds a billed version, so build the whole new JSON in memory and set it once.

1. In ONE process, read the current bundle with `firebase apphosting:secrets:access <BUNDLE>
   --project saoc-webapp` (the CLI appends one newline; strip exactly one), change the key in
   memory, and pipe the JSON to `firebase apphosting:secrets:set <BUNDLE> --data-file=-
   --project saoc-webapp --force`, run from a temporary directory outside the repo.
2. Never print, log or write a value to disk. Verify by re-reading the bundle and comparing a
   sha256 per key, printing only `KEY match/mismatch`.
3. Destroy the previous version: `gcloud secrets versions destroy <N> --secret <BUNDLE>
   --project saoc-webapp`. Leave one enabled version.
4. Redeploy so the running backend picks up the new `latest`.

Adding a brand-new key follows the same steps and needs no `apphosting.yaml` change. Do not add a
per-secret binding there. `RECONCILIATION_CRON_SECRET` is also held in the Cloud Scheduler job
header (`saoc-reconcile-orders`), so rotating it means updating that job as well.

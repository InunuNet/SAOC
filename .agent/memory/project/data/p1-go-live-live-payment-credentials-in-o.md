# p1-go-live-live-payment-credentials-in-o

**[P1] Go-live: live payment credentials.** In order: obtain live Merchant ID/Key/Passphrase;
  store in Secret Manager with `printf '%s' | --data-file=-` (**never `echo`** — see the secret
  corruption class); flip `lib/payfast.ts` off the sandbox constants; point `SITE_URL` at the real
  domain (**gated behind DNS cutover** — live ITNs will not land otherwise); re-verify the ITN
  signature path against a live transaction via the documented re-pin ceremony.
  **Do not go live before council-confirmed prices are in.**

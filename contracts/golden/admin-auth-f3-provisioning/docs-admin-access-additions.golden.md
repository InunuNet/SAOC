# `docs/admin-access.md` additions — golden spec

F3 extends the existing `docs/admin-access.md` (do not replace it — F1/F2's content on the
authorisation policy itself stays as-is). Add a new section, in this position and with these
exact `##` headers (grepped literally by `A-DOCS-01`, so match the header text exactly):

```
## Who may hold admin

## Granting admin access

## Revoking admin access

## Verifying grant or revoke actually took effect

## Disabling self-signup (defence in depth, console-only)
```

Content requirements per section (wording is the writer's, these are the facts that must be
present):

### Who may hold admin
State plainly: admin is for SAOC committee members with an operational need (door check-in,
ticket export), granted per person, not per role/device. No shared logins.

### Granting admin access
Document the command `pnpm exec tsx scripts/admin-grant.ts <email> [--existing]` and,
critically, the **two-step nature of granting**: (1) run the script, which creates the account
if needed, sets the `admin` claim, and (only on a fresh account) marks the email verified;
(2) separately add the same email to `ADMIN_EMAIL_ALLOWLIST` in Secret Manager (deployed) or
`.env.local` (local) — the script cannot do step 2 itself. Both steps are required; either
alone leaves the person unable to reach `/admin`. Reference the existing "empty-allowlist trap"
section already in this document rather than repeating it.

State plainly, using this exact phrase somewhere in the section: self-signup being left open
makes `scripts/admin-grant.ts` **dangerous against pre-existing accounts** — because the public
signup endpoint is still reachable (see "Disabling self-signup" below), an email an operator
means to grant may already belong to someone else's self-registered, unverified account. Explain
the `--existing` flag as the control for this: the script refuses to touch a pre-existing
account unless `--existing` is passed, and always prints the account's provenance
(`creationTime`, provider IDs, current `emailVerified`) before acting — an operator MUST read
that provenance and confirm it looks like the intended person before ever passing `--existing`.
State that granting onto a pre-existing account never sets `emailVerified: true` — the script
only verifies an email it created itself.

State, with this exact phrase, that operators must **not redirect this script's stdout to a
file** or run it under anything that logs or persists output — the one-time password reset link
printed on a fresh grant is usable by whoever reads it later, not just the intended recipient.

### Revoking admin access
Document `pnpm exec tsx scripts/admin-revoke.ts <email>`, and state explicitly that this
terminates access **immediately** — not in up to 5 days — because it calls
`revokeRefreshTokens`, which `lib/admin-auth.ts` already checks on every request
(`verifySessionCookie(cookie, true)`). State that removing the email from
`ADMIN_EMAIL_ALLOWLIST` is a recommended second step (defence in depth) but that the claim
revoke + session revoke alone already ends access on its own.

### Verifying grant or revoke actually took effect
Document `pnpm exec tsx scripts/admin-list.ts` to audit who currently holds the claim. State
the concrete verification the F1/F2 doc already recommends elsewhere in this file — sign in as
the account and confirm `/admin` loads (for a grant) or is refused (for a revoke) — rather than
trusting a script's exit code alone, consistent with this document's existing "confirm it by
actually signing in" guidance for the allowlist.

### Disabling self-signup (defence in depth, console-only)
State plainly, without hedging: this is a defence-in-depth measure, **not** a substitute for
the allowlist + claim gate (`lib/admin-auth.ts` already refuses a freshly self-registered
account with no claim, proven by `contracts/checks/admin-auth-hardening/check-probe-refused-
everywhere.mjs`). State that it is **console-only and cannot be verified by an automated
check in this repo** — name the reason: the classic Firebase "Email/Password" provider toggle
disables both sign-up and sign-in together, which would also break the admin login page itself,
so the correct control is the separate "restrict account creation" setting one level up in the
Google Cloud Identity Platform console for this project, not the Firebase Authentication panel.
Give the console path an operator can follow without guessing, even if this document has to
say "console UI, verify the exact menu path at time of use" rather than freeze a screenshot
that will drift.

# Golden spec — `docs/admin-access.md` F4 additions

Add two new `##`-level sections (exact headers, checked verbatim by
`check-docs-complete.sh`).

## `## Claim before allowlist`

Must state, in substance:
- **The hard rule:** an email address must be granted via `scripts/admin-grant.ts` BEFORE it is
  ever added to `ADMIN_EMAIL_ALLOWLIST`. The literal substring `before it is ever added` must
  appear.
- **Why:** an unallowlisted address grants nobody access regardless of what account exists
  behind it (F1's allowlist gate condition), so there is never a legitimate reason to allowlist
  first. Granting first means either a fresh, `admin-grant.ts`-owned, verified account gets
  created (and Firebase's own email-uniqueness enforcement then permanently prevents anyone else
  from ever registering that same address), or an existing account's provenance gets reviewed
  and explicitly confirmed before any claim is granted onto it.
- **What this defends against:** the account-linking hazard — a Google/Microsoft/Apple sign-in
  for an address with a pre-existing self-registered password account LINKS onto and verifies
  that account, leaving the squatter's original password credential working. The literal phrase
  **`account linking`** must appear.
- **This is a documented operator discipline, not a platform setting** — the literal substring
  `does NOT prove` must appear, matching F3's own precedent (a script or a doc cannot force an
  operator to follow an ordering rule; this is stated plainly rather than implying a false
  guarantee).

## `## Google sign-in`

Must state, in substance:
- Enabling Google in Firebase Console → Authentication → Sign-in method requires only a support
  email — Google's OAuth client is auto-configured, tied to the project already on GCP. No
  credential lands in this repo's `.env.local` or any app env var — the literal substring
  **`GoogleAuthProvider`** must appear, referencing the client-side construct used in
  `app/admin/login/page.tsx`.
- `scripts/admin-grant.ts`'s existing-account refusal now prints an explicit warning — the
  literal substring **`password`** paired with **`never verified`** (or equivalent phrasing
  covering the same shape) must appear — when a pre-existing account has no federated provider
  and is unverified, telling the operator to check whether the intended person has already
  signed in via a federated provider elsewhere before deciding `--existing` is safe.
- A worked example: an operator runs `admin-grant.ts` on an address about to be onboarded and
  sees the new warning — this does not automatically mean an attack occurred, but the operator
  must independently confirm the account belongs to the intended person (e.g. by asking them
  whether they've ever used this admin panel before) before proceeding with `--existing`.

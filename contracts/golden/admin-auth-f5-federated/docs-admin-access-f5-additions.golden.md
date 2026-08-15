# Golden spec — `docs/admin-access.md` F5 additions

Add two new `##`-level sections (exact headers, checked verbatim by `check-docs-complete.sh`).

## `## Microsoft sign-in`

Must state, in substance:
- Requires an **Entra** ID (Azure AD) app registration — the literal substring `Entra` must
  appear — via `Quickstart: Register an app with the Azure Active Directory v2.0 endpoint`.
  Redirect URI to register: `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler` (the literal
  substring `__/auth/handler` must appear).
- Tenant decision: registered for any organisational or personal Microsoft account (`common`
  endpoint), not restricted to a single tenant — state the rationale (no dedicated Entra tenant
  currently, allowlist is the real boundary regardless).
- Client ID and Client Secret from that registration are entered into Firebase Console →
  Authentication → Sign-in method → Microsoft, never into this repo's `.env.local`.

## `## Apple sign-in`

Must state, in substance:
- Requires a **paid Apple Developer Program** membership (the literal substrings
  `Apple Developer Program` and a cost figure must appear) — no free tier covers Sign In with
  Apple configuration.
- Requires creating a **Services ID** (literal substring `Services ID`), a Sign In with Apple
  private key with its Key ID, and noting the account's **Team ID** (literal substring
  `Team ID`) — all from Apple's developer site.
- Return URL to register: `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler` (the literal
  substring `__/auth/handler` must appear here too).
- The **private email relay** interaction: a user may present an opaque
  `<opaque>@privaterelay.appleid.com` address (the literal substring
  `privaterelay.appleid.com` must appear) instead of their real one, which the email-based
  allowlist cannot pre-populate before a first sign-in attempt. State both operational options
  from README.md decision (ask the member to disable relay, or capture the relay address from a
  refused first attempt) without mandating one.
- All four credential values (Services ID, private key, Key ID, Team ID) are entered into
  Firebase Console → Authentication → Sign-in method → Apple, never into this repo's
  `.env.local`.

# Golden spec — Microsoft and Apple sign-in on `app/admin/login/page.tsx` (F5)

Extends F4's golden spec (`contracts/golden/admin-auth-f4-google/login-google-button.golden.md`
— read first). Same shape, two more providers, one provider-specific addition.

## Required behaviour

- Add "Sign in with Microsoft" and "Sign in with Apple" buttons alongside the existing
  password and Google paths.
- Microsoft: `new OAuthProvider('microsoft.com')` from `firebase/auth`. No `tenant` custom
  parameter set (defaults to `'common'` — any organisational or personal Microsoft account, per
  README.md decision).
- Apple: `new OAuthProvider('apple.com')` from `firebase/auth`, with an explicit
  `provider.addScope('email')` call (and, recommended, `provider.addScope('name')`). Firebase
  already auto-requests these scopes from Apple under the default "One account per email
  address" setting this project keeps (F4's revised decision — see F5 README.md), so this is
  defensive explicitness rather than a fix for a broken default: stating the requirement in code
  is more robust than relying on an implicit default that could change, and costs nothing.
- Both new paths converge on the exact same idToken → `POST /api/admin/session` → redirect
  function F4 established for Google. No provider-specific branch in that function beyond
  selecting which `AuthProvider` instance to sign in with.

## What must NOT happen

- No new API route, no provider-specific branch inside `/api/admin/session` or
  `lib/admin-auth.ts` (unchanged from F4's constraint — this contract does not re-touch those
  files at all).
- Apple's `email` scope omission — this is the one provider-specific footgun in this feature and
  the check enforces it directly.

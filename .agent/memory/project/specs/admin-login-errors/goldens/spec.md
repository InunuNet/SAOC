# admin-login-errors: implementation spec (P1)

Source: SAOC relay of Brad's live test. Lee-Ann cannot sign in at /admin/login with email and password; she sees the raw
"Firebase: Error (auth/invalid-credential)" and has no recovery. Worktree `.tmp/sandbox/admin-login`, branch
`fix/admin-login-errors`.

## Decision

Extract the pure logic into `lib/admin-login-errors.ts` (no firebase import, so `tsx` can unit-test it); keep all Firebase
calls in the page. `app/admin/login/page.tsx` keeps its OAuthProvider literals and `/api/admin/session` call
(admin-auth-f5-federated A-STRUCT-01 greps that file).

## `lib/admin-login-errors.ts` exports

- `GENERIC_SIGN_IN_ERROR`, `NETWORK_ERROR_MESSAGE`: moved here from page.tsx (the network string is the existing
  `federatedSignInErrorMessage` copy). `federatedSignInErrorMessage` imports them, so each string exists once.
- `firebaseErrorCode(err: unknown): string | undefined`: moved from page.tsx unchanged.
- `passwordSignInErrorMessage(err: unknown): string`, by `firebaseErrorCode`:
  - the six codes in copy.json `codesSameAsInvalidCredential` return `invalidCredential`, one identical string
    (non-enumerating; `invalid-email` is format-only and safe; `missing-password` joins them).
  - `auth/too-many-requests` returns `tooManyRequests`.
  - `auth/network-request-failed` returns `network`.
  - everything else returns `generic`: includes `auth/user-disabled` (reveals the account exists), a plain
    `Error('Firebase: ...')`, a non-Error, and `Error('Session creation failed')` from `mintSession`.
  - never returns or embeds `err.message`.
- `requestPasswordReset(email, send)`: `send: (email: string) => Promise<void>` is injected so tests mock it.
  Returns `Promise<{ status: 'prompt' | 'sent'; message: string }>`.
  - Trimmed email empty: `{ status: 'prompt', message: resetEmptyPrompt }`, `send` not called.
  - Otherwise call `send(trimmed)` and ALWAYS return `{ status: 'sent', message: resetResponse }`, whether `send` resolves
    or rejects with anything (user-not-found, invalid-email, too-many-requests, network, unknown).
  - On rejection, `console.error` the error code only (never the email, never `err.message`).

## `app/admin/login/page.tsx`

- `handleSubmit` catch: `setError(passwordSignInErrorMessage(err))`. Keep the `console.error` with code. No `.message`
  access anywhere in the file.
- Add `notice` state and `handleForgotPassword`: clears `error`, calls
  `requestPasswordReset(email, (e) => sendPasswordResetEmail(getAuth(getFirebaseApp()), e))`. On `prompt`: `setError(message)`,
  `setNotice('')`. On `sent`: `setNotice(message)`, `setError('')`. `handleSubmit` and the federated handler clear `notice`.
- Import `sendPasswordResetEmail` from `firebase/auth`.

## `app/admin/login/LoginFormFields.tsx` (presentational only)

- New props `notice: string`, `onForgotPassword: () => void`.
- A `type="button"` control labelled exactly `Forgot password?`, `data-testid="admin-forgot-password"`, between the
  password field and the alert slot, `disabled` with the form, at least 44px tall.
- `notice` renders in a `role="status"` paragraph using the SAME class string as the existing `role="alert"` box.
- Styling: class tokens already present in the login directory at origin/main only (A3 enforces: every class token on an
  added line already exists in the baseline). No new colours, sizes or tokens (docs/rules/no-invention.md). The
  design/design_handoff_saoc handoff adds nothing for this control.

## Copy (goldens/copy.json is the source of truth)

Verbatim from SAOC: `invalidCredential`, `resetResponse`. Existing page copy: `network`, `generic`.
COPY CONFIRMED by SAOC 2026-10-24 (tooManyRequests, resetEmptyPrompt as proposed; resetResponse ends with a full stop).

## Out of scope

No self-signup. `lib/admin-auth.ts`, `app/api/admin/session`, Firestore and Firebase writes unchanged. Checks never reach
Firebase: the browser gate fulfils `identitytoolkit.googleapis.com` calls from route mocks and aborts any other external call.

## Docs

Append a "Sign-in errors and password reset" section to `docs/admin-access.md` (mapping table, non-enumerating reset, the
unset-password recovery path via Forgot password, the two copy gaps).

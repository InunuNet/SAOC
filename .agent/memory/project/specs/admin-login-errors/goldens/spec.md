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
  `requestPasswordReset(email, (e) => sendPasswordResetEmail(getAuth(getFirebaseApp()), e))`. On `prompt`: `setEmailError(message)`,
  `setNotice('')`. On `sent`: `setNotice(message)`, `setError('')`. `handleSubmit` and the federated handler clear `notice`.
- Import `sendPasswordResetEmail` from `firebase/auth`.

## `app/admin/login/LoginFormFields.tsx` (presentational only) - amended after NOS Design FAIL of #73 (33/40)

Rulings, quoted from NOS Design via team-lead:
- Fix 1: "Forgot password?" goes directly under the password field, right-aligned, 8px gap, in the site's existing inline link
  style (the underline treatment on 'Wild Orchids of Southern Africa' in the footer). No new style. Hit area >= 44px tall via
  padding, not font size. Visible focus ring. A `<button type="button">` with link styling, so Enter in password still submits.
- Fix 2: the error and the success must differ. Error: the existing field-alert treatment (#9B2C2C text, warning glyph, left
  rule), role="alert", focus moved to it. Reset sent: keep the neutral box, role="status". No new colours or tokens.
- Empty email on reset: an inline error on the Email field with the SAOC-approved string, focus on Email.

Implementation:
- Props: `notice: string`, `emailError: string`, `onForgotPassword: () => void`; page.tsx owns focus (ref or id focus).
- Forgot control: `type="button"`, `data-testid="admin-forgot-password"`, label exactly `Forgot password?`, class `inline-link`
  (app/globals.css, the footer's treatment: `components/home/MissionBlock.tsx`) plus padding (e.g. py-3) for a >= 44px box
  and the page's existing `focus-visible:outline ...` ring tokens. Inside the password block, right-aligned (`flex justify-end`),
  top of the control box 0-8px below the input bottom (mind the form's `space-y-5`; place it inside the password block).
  Disabled with the form. Enter in #password must still submit (no preventing default, button not type=submit).
- Sign-in error: the shared alert `TicketFieldAlert` from `components/tickets/TicketFormField.tsx` (SAOC per-field errors, #33
  rFE; ALERT_CLASS = flex gap-2 border-l-2 border-error ...). Do not edit that component. It is not focusable, so wrap it in an
  element with `tabIndex={-1}` and focus the wrapper after setting the error (the alert is inside it). Replaces the old bone box.
- Empty-email prompt: `TicketFieldAlert` directly under the Email input with an id, `aria-invalid` on #email,
  `aria-describedby` to that id, and focus moved to #email. Cleared on the next reset, sign-in attempt or edit.
- In-flight guard (Codex finding on page.tsx): `handleForgotPassword` returns early while a reset is pending (state or ref), and the
  control is `disabled` while pending, so a double click sends exactly one request. Re-enabled when the send settles.
- Reset sent: keep the existing neutral bone box, `role="status"`, no glyph, not error-coloured.
- Class tokens: only tokens already used somewhere in app/ or components/ at origin/main (A3 enforces; `inline-link` allowed). No
  hex or rgb values, no globals.css change.

## Copy (goldens/copy.json is the source of truth)

Verbatim from SAOC: `invalidCredential`, `resetResponse`. Existing page copy: `network`, `generic`.
COPY CONFIRMED by SAOC 2026-10-24 (tooManyRequests, resetEmptyPrompt as proposed; resetResponse ends with a full stop).

## Out of scope

No self-signup. `lib/admin-auth.ts`, `app/api/admin/session`, Firestore and Firebase writes unchanged. Checks never reach
Firebase: the browser gate fulfils `identitytoolkit.googleapis.com` calls from route mocks and aborts any other external call.

## Docs

Append a "Sign-in errors and password reset" section to `docs/admin-access.md` (mapping table, non-enumerating reset, the
unset-password recovery path via Forgot password, the two copy gaps).

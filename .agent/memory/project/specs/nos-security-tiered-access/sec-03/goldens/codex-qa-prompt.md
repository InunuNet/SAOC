# Codex adversarial review, SEC-03

Review the whole diff of fix/sec-03-signup-gate against origin/main. Try to break these claims.

1. POST /api/events/submit reaches the Sanity write only for a token that passes `isAdminToken()` after `verifyIdToken(token, true)`. Find any path (header casing, token in another header, rate-limit ordering, thrown error caught as success) that reaches the write with a verified non-admin, a deleted, disabled or revoked user.
2. Refusal bodies are only the existing strings "Unauthorized" (401) and "Forbidden" (403). No reason leaks to the caller.
3. `/events/submit` page renders the form only when `getAdminSession().ok`.
4. `scripts/auth-disable-signup.ts`: PATCH mask is exactly `client.permissions.disabledUserSignup`; the config response body (it contains `signIn.hashConfig.signerKey`) is never logged, thrown, or put in an error message, including on non-2xx responses; a fixture can never reach a PATCH; apply is idempotent and read-back mismatch exits non-zero; no secret or access token is logged.
5. No new user-facing copy was invented (docs/rules/no-invention.md).

Golden policy: sec-03-decisions.golden.md. Matrix: route-auth-matrix.golden.json. Report PASS or FAIL with file:line evidence.

# Golden: F2 general Settings (/admin/settings)

Brad: "Just general settings will be more for the admin dashboard and the user profile." Open to every signed-in admin (`getAdminSession().ok`, which already enforces `admin` + verified email + live allowlist). No capability gate.

## Files
- `app/admin/(shell)/settings/page.tsx` -> rewritten as a SERVER component (the old client page's payment UI moves to `PaymentSettingsPanel`; it must not remain here).
- `app/admin/(shell)/settings/layout.tsx` -> delete, or reduce to a session-only check. It must not mention `manage-payment-settings`. `(shell)/layout.tsx` already redirects the signed-out visitor; the page re-checks `getAdminSession()` itself (defence in depth, same as other gated subtrees).
- `components/admin/SettingsSignOut.tsx` (`'use client'`) -> one button calling `useAdminSignOut()`.
- `loading.tsx`, `error.tsx` stay.

## Profile section (read-only; every value from the verified token, never from the client)
| row | source |
|---|---|
| Name | `decodedToken.name` when present, else omit the row |
| Email | `decodedToken.email` |
| Sign-in provider | `decodedToken.firebase.sign_in_provider`: `password` -> Email and password, `google.com` -> Google, `microsoft.com` -> Microsoft, `apple.com` -> Apple, anything else -> the raw value |
| Roles and scope | `decodedToken.roles` (`Record<string,string[]>`): one line per scope key, `*` shown as "All shows", a show id shown as the id; no `roles` claim, or one not shaped `Record<string,string[]>`, -> "No roles assigned" (a plain admin; true per docs/admin-access.md) |
| Sign out | button "Sign out", helper "Signing out ends your session on every device." (docs/admin-access.md: sign-out calls `revokeRefreshTokens`, i.e. it IS sign-out-everywhere; no second action is built) |
Provider and roles are display only; changing either is out of scope.

## Dashboard section
Omitted. Searched the repo: no per-admin dashboard preference exists in code, storage or docs (the dashboard cards are fixed, `lib/admin-dashboard.ts`). The page shows Profile only. Do NOT add a "Dashboard preferences" heading, empty or otherwise. Question for Brad below.

## Questions for Brad (gaps, not blockers)
1. Dashboard section: is there a preference he wants (e.g. which cards show, default landing page)? None exists to source, so none is built.
2. Is "Sign out" (which already ends sessions everywhere) enough for the "sign-out-everywhere" idea, or does he want a separate action that keeps the current device signed in?
3. Nav icon for "Payment settings": reuse of the existing Tickets glyph, or a new card glyph?
4. Copy marked PROPOSED in page-states.md.

# Codex QA prompt — admin-redesign F1

Review the whole diff on this branch against .agent/memory/project/specs/admin-redesign/goldens/codi-ruling.md (final; do not question the design) and the other goldens in that folder. Be adversarial. Report PASS/FAIL with file:line.

Attack surface, in priority order:
1. Auth: any admin page, layout or API gate weakened, moved out of its subtree, or made conditional. app/admin/(shell) move must preserve every getAdminSession/hasCapability/redirect. app/api/admin/whoami must leak no token/claims, return no-store, and 401 for non-admins. Admin pill must not reveal admin existence to non-admins beyond a 401.
2. Fixture route: could ADMIN_FIXTURES ever be enabled in production (apphosting.yaml, defaults, build-time inlining)? Does notFound() happen before any fixture data renders? pathnameOverride used anywhere outside fixtures?
3. firebase-admin or server-only imports reachable from any 'use client' module or marketing layout (including AdminPill).
4. Marketing layout stays static: no cookies()/headers() added to app/(marketing).
5. Regression of vendor actions inside DetailDrawer: review transitions, payment link, photo link, publish listing, reissue code — same endpoints, payloads, error handling; double-submit protection.
6. Focus trap / Esc / body scroll lock / focus return for both the mobile drawer and the detail drawer; aria-current; 44px targets; wake-lock release on unmount.
7. Horizontal overflow: any min-w, whitespace-nowrap, fixed px widths that exceed viewport at 390/768/1024/1280; truncation without title.
8. Token discipline: hex or rgba not in app/globals.css or design/design_handoff_saoc (sole exception rgba(34,40,31,.55) scrim); new copy strings beyond the ruling's quoted ones (docs/rules/no-invention.md).
9. Firestore: no undefined writes (none expected), count() queries, UTC vs SAST in "Updated hh:mm".
10. Newsletter: Newsletter nav item and subscriber card absent while available:false; no broken link.

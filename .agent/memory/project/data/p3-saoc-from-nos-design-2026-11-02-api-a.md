# p3-saoc-from-nos-design-2026-11-02-api-a

**[P3, SAOC, from NOS Design 2026-11-02] /api/admin/whoami returns 401 for every anonymous visitor on public NOS pages** (components/admin/useIsAdmin.ts via AdminPill), one console error per page view. Not a security hole as reported; check for a non-erroring signed-out path when next in that code.

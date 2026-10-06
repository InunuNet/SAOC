# p3-non-ascii-basic-auth-credentials-neve

**[P3] Non-ASCII Basic Auth credentials never authenticate in `proxy.ts`**
  (beta-password-wall F1, 2026-10-06) — `constantTimeEqual()` runs `TextEncoder().encode()`
  on a string already binary-split by `atob()`'s Latin-1 decoding of the Authorization
  header, so a multi-byte UTF-8 character in the credential re-encodes to a different byte
  sequence than the plain JS string's own UTF-8 encoding. Lockout only, no security impact —
  current credentials are ASCII. Fix would be decoding with a proper UTF-8-aware base64
  decode instead of raw `atob()`. Evidence: `.agent/memory/scratch/qa-report-beta-password-wall-f1.md` finding #13.

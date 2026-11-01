# admin-session-body-cap (B2)

Cap the bytes read by `POST /api/admin/session`. Nothing else changes.

## Decisions
- Cap: 4096 bytes (4 KiB), named constant. Evidence it clears a real token: a Firebase ID token is header (~190 chars) + payload + signature (342 chars). Firebase limits custom claims to 1000 bytes (~1334 base64 chars); standard claims with email and the `firebase` identities block are ~550 bytes (~740 chars). Worst case about 2.7 KB, plus a ~15 byte JSON envelope. 4096 leaves about 35% headroom. Golden S5 posts a 3000-char token and S6 asserts the exact boundary.
- Where: before `request.json()`, so before any parse, verifyIdToken or createSessionCookie. Replace `request.json()` with read-capped-then-`JSON.parse`; invalid JSON stays 400 with the same body.
- Helper: `readCappedBody` is NOT on origin/main (grep of lib/ and app/ returns nothing; F3's `lib/webhook-body.ts` is unmerged). To avoid an add/add conflict when F3 merges, create a NEW file `lib/admin-session-body.ts` with a distinct export name (`readBodyCapped`). F3 can fold the two later; that is F3's follow-up, not this branch. Do not create `lib/webhook-body.ts`.
- Read by bytes actually pulled: iterate `request.body.getReader()`, count `value.length`, on exceeding the cap `reader.cancel()` and return 413 `{ error: 'Request body too large' }`. A Content-Length pre-check may be added as a fast path only, never as the sole gate. Null body counts as empty (400 as today).
- 413 body `{ error: 'Request body too large' }`. No other response, header, cookie or status changes. `DELETE` untouched. lib/admin-auth.ts and the admin auth posture unchanged.

## Not in scope
Trusted-XFF routes (deferred until F3 merges). Copy changes. F3 branch fix/sec-abuse-controls.

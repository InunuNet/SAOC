# Speakers Partner ticket (N11) — security and behaviour spec

Source: Brad 19 Nov 2026 (R950 partner ticket, hidden, unlisted link, ONE shared password, covers WOSA Conference + Symposium).
The password VALUE is never handled by an agent: Brad sets it in .env.local and Secret Manager himself. Tests use a throwaway string.

| Concern | Rule |
|---|---|
| Env var | `SPEAKERS_PARTNER_PASSWORD`, server-only (no NEXT_PUBLIC), `.env.local.example` carries it blank |
| Fail closed | unset or blank: nobody gets in; the refusal is identical to a wrong password (same body, status 403) |
| Compare | both sides SHA-256 hashed then constant-time compared; always compares, even when unset |
| Rate limit | 5 attempts per 15 min per client IP (`clientIpFromForwardedFor`, second-to-last XFF hop); 429 + Retry-After. In memory per instance (App Hosting maxInstances 2): accepted, the password is the real protection; QA must try a spoofed leading X-Forwarded-For entry |
| Session | httpOnly, sameSite lax, secure in production cookie `speakers_partner_access`, 1 h, HMAC keyed from the password so rotating the password revokes every session |
| Checkout | the route re-checks the cookie BEFORE any CMS or Firestore work; no cookie gives the same 400 as an unknown ticket type; exactly one line item, quantity 1, nothing else in the cart |
| Unlisted | route `/tickets/speakers-partner`, `robots: noindex,nofollow,nocache`, not in sitemap, not in nav, not in hub, NOT in robots.txt (a Disallow advertises it); generic `/tickets/[slug]` must not serve it |
| Sanity doc | created only with `--with-partner` AFTER the protecting code is deployed; never overwritten |
| Secret wiring | apphosting.yaml reference stays commented until Brad creates the Secret Manager secret (a missing secret fails the rollout) |
| Capacity | 40 is a web-team placeholder, not from any client source: flag to Brad, do not invent further |
| Quantity | assert `quantity === 1` on the line item itself, not only `lineItems.length === 1` |
| Email | maps to the `saoc-wosa-joint` copy (one ticket, both events) |

Go-live (waits for Brad's word): mirror SPEAKERS_PARTNER_PASSWORD to Secret Manager, then uncomment the apphosting.yaml reference.

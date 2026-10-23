# Golden: newsletter topic choice (nos-site-split F5)

Current: `newsletterSubscribers` docs carry `source: 'saoc-footer'|'nos-footer'` (lib/newsletter-store.ts:23, lib/newsletter-handler.ts:98). `source` stays (where they signed up). Add additive field `topics: Array<'saoc'|'nos'>` (non-empty, de-duplicated, order saoc then nos).

- POST /api/newsletter/subscribe body gains optional `topics`. Absent or invalid-empty => default derived from source: saoc-footer -> ['saoc'], nos-footer -> ['nos']. Unknown topic strings => 400. Existing request shape without `topics` must keep working byte-for-byte (back-compat test).
- Doc id (sha256 of normalised email) unchanged. Re-subscribing an existing email MERGES topics (union) and sets status 'subscribed'; never drops a topic.
- Reading legacy docs with no `topics`: `toSubscriber` derives topics from source (no migration script, no backfill write).
- UI (design-rulings R4): fieldset under the email field, before Subscribe, two native checkboxes labelled from the existing NEWSLETTER_COPY.adminSourceSaoc ("SAOC") and adminSourceNos ("National Orchid Show"); own site's list first and pre-checked; rows >= 44px, 16px labels; sr-only legend = FOOTER_HEADINGS.touch. Both unchecked blocks submit with an inline error under the group (aria-describedby, focus to first checkbox); the error TEXT is a COPY GAP: ship it as a visibly flagged placeholder per docs/rules/no-invention.md (never a silent invented string, never blocking). Success reuses NEWSLETTER_COPY.success. Server also validates (400) when topics is an empty array.
- Unsubscribe (token link, host-neutral page) unsubscribes the whole address (topic-level unsubscribe is out of scope; say so in docs/newsletter-subscribe.md).
- Admin CSV export (app/api/admin/newsletter/export-csv/route.ts): add a `topics` column (`saoc;nos`), keep existing columns and order, append at the end.
- Firestore write safety: no `undefined` own-properties (docs/firestore-undefined-write-safety.md).
- Update docs/newsletter-subscribe.md and the CLAUDE.md collection row only via @docs (CLAUDE.md is floor-protected; use Route 1 enforcement_edits if @docs must touch it; otherwise leave CLAUDE.md).

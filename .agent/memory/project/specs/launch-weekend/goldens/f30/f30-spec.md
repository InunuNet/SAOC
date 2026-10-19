# F30 - Exhibitors and Vendors listing (spec for @dev)

Decisions by Brad, 2026-10-19: list approved vendors for now (ask Lee-Ann); listing data lives in Sanity and is editable in Studio by Brad and Lee-Ann; an admin "Publish to listing" action copies an allowlisted projection from Firestore into Sanity; ONE listing; reuse what exists.

## 1. Reuse, do not add (verified on origin/main abd58f59)
- Page: `app/(marketing)/national-show/vendors/page.tsx` ("Exhibitors and vendors") already fetches `vendorNurseriesQuery` and renders `VendorGrid` (list empty -> its existing empty state; holding logic unchanged). It is NOT edited.
- Sanity type: `vendorNursery` (name, logo, country, owner, history, specialisation, plantsBrought, website, socialMedia, availableAtShow). Extended with ONE field, not duplicated.
- `/national-show/sa-exhibitors` and `/international-guests` already read the same type. Untouched; a published vendor with a country will also appear on one of them. Flagged, not changed.

## 2. Public vs private
The form captures contact, vehicle, insurance, permit, payment and signature data; none is ever copied. Allowlist: `goldens/f30/projection-allowlist.json` (name, country, website, bio). Logo, photos, social, categories, stand number are deferred (reasons in that file). The Vendor Listing.xlsx outreach tracker is never read or seeded.

## 3. Consent
The form has ONE signal: `marketingPermission` radio, optional: `full` (event marketing use) or `listing-only` ("I do not grant permission for use beyond the vendor listing"). Both options accept the listing, so both count as consent to list. Absent = no signal = do not publish, unless the admin explicitly acknowledges (API body `acknowledgeNoConsent: true`, UI confirms). The listing carries only the allowlisted fields in either case.

## 4. Eligibility: one named predicate
`isVendorListingEligible({ status, paymentReceived?, standOrderStatus? })` in `lib/vendor-listing.ts`, today `status === 'approved'` exactly. It is the ONLY place the basis lives (check A5 greps for stray `'approved'` literals in F30 files). `LISTING_ELIGIBILITY_BASIS = 'approved'` is exported for docs. Switching to paid later = change this body only.

## 5. Module contract: `lib/vendor-listing.ts` (pure; type-only imports from `@/types/index`; NO firebase, sanity or next imports; no 'use client')
- `isVendorListingEligible(input)` as above.
- `resolveListingConsent(marketingPermission?: string | null): 'granted' | 'missing'`.
- `listingDocumentId(submissionId: string): string` -> `vendorNursery-${submissionId}` (hyphen, see republish-rule.json).
- `projectVendorListing(submission): { name: string; country?: string; website?: string; bio?: string }` per the mapping in projection-allowlist.json. Strips blanks; never leaves an undefined own property.
- `publishVendorListing(deps, input)`:
  - `deps.sanity`: `{ getDocument(id): Promise<{ _id: string } | null>; createIfNotExists(doc): Promise<unknown> }`. No other method is used (checks hand in a Proxy that throws on anything else).
  - `input`: `{ submission, standOrderStatus?, acknowledgeNoConsent: boolean }`.
  - Returns `{ ok: true, outcome: 'created' | 'already-listed', documentId }` or `{ ok: false, reason: 'not-eligible' | 'consent-missing' }`.
  - Order: eligibility, consent, then existence check of BOTH `documentId` and `drafts.<documentId>` (either present -> already-listed, zero writes), then one `createIfNotExists({ _id, _type: 'vendorNursery', ...projection })`.
- `lib/vendor-listing-sanity.ts`: server-only adapter building the write client from `SANITY_API_TOKEN` + `sanity/env` (mirror `app/api/events/submit/route.ts`; token never `NEXT_PUBLIC_`). Missing token -> adapter throws a typed error the route maps to 500 "CMS not configured".

## 6. Route: `POST /api/admin/vendors/[id]/publish-listing`
- Same gate as `app/api/admin/vendors/[id]/review/route.ts`: `getAdminSession` (401/403) then `hasCapability(..., 'review-vendor-applications', ...)`.
- Body `{ acknowledgeNoConsent?: boolean }`; 404 if submission missing; `not-eligible` -> 409; `consent-missing` -> 409 with `reason`; created -> 200; already-listed -> 200.
- Reads `vendorSubmissions/{id}` (and `vendorStandOrders/{id}` status only when the predicate needs it later; today unused).
- On outcome `created` only: `ref.update({ listingPublishedAt: now, listingPublishedBy: email ?? null, listingDocumentId })`. Add these three optional fields to `VendorSubmission` in `types/index.ts`. Update, never full overwrite. Audit write failure is logged and does not undo the (idempotent) Sanity create.
- Logs: operation, submission id, error type; no PII, no token.
- Optional: call the existing revalidate path for tag `vendorNursery`; page is already `revalidate = 60`, so not required.

## 7. Sanity + render
- `vendorNursery` schema: add `bio` (text, title "Bio"). Nothing else. No contact fields ever.
- `vendorNurseriesQuery`: project `bio` (the file's own comment demands every schema field is projected). The two country-filtered queries are left alone.
- `SanityVendorNursery` + `VendorGrid`: render `bio` as one paragraph using the identical class string as the neighbouring paragraphs. No new token, colour, font or copy.
- Seeding: none. The Studio list is empty until an admin publishes; the existing empty state shows.

## 8. Admin UI
In `VendorReviewTable.tsx`, rows where the predicate is true (client may mirror via a prop computed server-side or just by status) show a "Publish to listing" button posting to the route; on `consent-missing` it asks for confirmation and retries with `acknowledgeNoConsent: true`. Match the table's existing button idiom. No new page.

## 9. Gaps flagged, not designed (no-invention)
- No design for a vendor card beyond what `VendorGrid` already renders (it is SAOC-owned, theme-inherited). If Brad wants a richer card that is a Claude Design handoff.
- Public copy (what "approved" means, whether to say "confirmed exhibitors") is Lee-Ann's. The page's existing lede and "To be confirmed" marker are untouched.
- Open questions: contract `open_questions`.

## 10. Safety of checks
All checks are offline: fixtures, an in-memory Sanity double, no network, no `createClient`, no `getFirestore`, no env tokens. Check A7 greps the check directory to enforce that.

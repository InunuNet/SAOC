# F2b: /admin/vendors/[id] full registration view (read-only)

## Files
- `app/admin/(shell)/vendors/[id]/page.tsx` (server component, `export const dynamic = 'force-dynamic'`)
- `components/admin/VendorSubmissionDetail.tsx` (server component, no `'use client'`, no `dangerouslySetInnerHTML`)
- one-line addition in `components/admin/VendorReviewTable.tsx` `renderFooter` (or the drawer): a link "View full registration" -> `/admin/vendors/${row.id}`. Reuse an existing admin link/button class from `components/admin/tokens.ts`. No other table change.
- optional `app/admin/(shell)/vendors/[id]/loading.tsx` / `error.tsx` copying the sibling ones.

## Access
`app/admin/(shell)/vendors/layout.tsx` already gates the subtree (redirect to /admin/login, or /admin without `review-vendor-applications`). This page holds full PII (addresses, vehicle plates, insurance policy numbers), and a Next layout is not re-run on every client navigation, so the page ALSO calls `getAdminSession()` and `hasCapability(..., 'review-vendor-applications', { now, lookupShowWindow })` itself and redirects exactly as the layout does. Same imports as the layout. No new capability.

## Data
1. `db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id).get()`; missing -> `notFound()`.
2. `serializeVendorSubmission(doc.id, doc.data())` (lib/firestore-serialization.ts) before anything is rendered or passed on. Never spread raw `doc.data()`.
3. Stand order: `VENDOR_STAND_ORDERS_COLLECTION` doc with the same id, read `status` only (absent -> "Not started"), same labels as `VendorReviewTable`'s `STAND_PAYMENT_LABELS` (export them from one place rather than duplicating, or import if already exported).
4. Linked application: submissions store NO application id (verified: `app/api/vendors/register/route.ts` writes none). Match best-effort: query `vendorApplications` for `contactEmail == submission.contactEmail`, keep rows whose normalised (trim, lower-case) `businessName` equals the submission's; serialise with `serializeVendorApplication`. Exactly one match -> "Original application" section (indicative stands, categories, status, submittedAt, reviewedAt/By). Zero or several -> a muted line "No single matching application found." Label the section "matched by business name and email". Do NOT add a linking field or write to any doc in this feature (follow-up, see below).
5. Page makes zero writes: no `.set(`, `.update(`, `.add(`, `.delete(`.

## Sections (heading text is asserted verbatim)
Each row is label/value; empty -> "—" (reuse the drawer's `NOT_PROVIDED`); booleans -> Yes / No / "—" for undefined; arrays -> comma list or "—"; Dates via `formatAdminDateTime`; enums via the existing label maps (`vendorCategoryLabels`, `getBoothTypeLabel`, ...) and a humanised fallback, never a raw slug.

| Heading | Fields |
|---|---|
| Business | businessName, tradingName / tradingNameSameAsBusiness, businessEntityType(+Other), cipcNumber, vatRegistered, vatNumber, countryOfBusinessRegistration, physicalAddress, postalAddress / postalAddressSameAsPhysical, website, socials (facebook/instagram/tiktok/youtube/other + legacy socialMediaHandle), status, submittedAt, reviewedBy/At |
| Contact | contactPersonName, contactPosition, contactEmail, contactCellPhone, alternativeContactNumber, accountsContactName/Email |
| Emergency contact | emergencyContactName, emergencyContactRelationship, emergencyContactCellPhone |
| Products and permits | vendorCategory(+Other), productDescription, bio, sellsLivePlants, livePlantTypes(+Other), plantsImportedForEvent, importCountryOfOrigin, citesListedSpecies, phytosanitaryPermitNumber, citesPermitNumber, plus the existing "recorded as submitted, not verified by SAOC" note |
| Food | foodVendorCertifications (array), foodHandlingCertificateNumber, foodItemList, foodHealthTradingDocumentation, foodPreparationOnSite, foodCookingOnSite |
| Booth | boothSize (fallback boothCount for pre-M2), boothType, tableCount, chairCount, boothPositionRequest, adjacentBoothRequested/VendorName, specialDisplayRequirements, boothNumber |
| Electrical and water | powerRequired, electricalOutletsRequired, electricalLoad (legacy), electricalEquipmentEntries (table), electricalEquipmentList (legacy), continuous-operation flag+details, waterRequired, waterIntendedUse, wastewaterDrainageRequired/Details |
| Gas and heat | gasOrHeatEquipmentUsed, gasEquipmentEntries (table), legacy gasEquipmentType/gasFuelType/gasCylinderSize/gasCylinderCount, gasSafetyInformation |
| Staff and vehicles | staffCountSetupDay/Day1/Day2/Day3/BreakdownDay, staffPerDay (legacy), exhibitorPassesRequired/Count, vehicleType(+Other), vehicleHeight/Length, trailerAttached, the seven *RegistrationNumber fields + otherVehicleDescription, vehicleRegistrations (legacy), loadInSlot, loadOutSlot |
| Storage | storageRiskAcknowledged |
| Waste | wasteTypes(+Other), specialWasteRequirements |
| Marketing and uploads | marketingPermission, logoPath/UploadedAt, productPhoto1-3 path/UploadedAt (count x/3 as in the drawer), listing published state |
| Insurance | hasPublicLiabilityInsurance (legacy), publicLiabilityInsurancePolicyNumber, productLiabilityInsuranceStatus, productLiabilityInsurancePolicyNumber |
| Payment | stand-order status (gateway), paymentMethodsAccepted, paymentReference, proofOfPaymentPath/UploadedAt, paymentReceived (office), paymentConfirmedBy/At |
| Declaration and terms | termsAccepted, signatureFullName, submittedAt |
| Original application | see Data 4 |

Upload paths are shown as the file's base name only. No signed URLs, no download links in this feature (follow-up).

## Pre-M2 documents
A submission written before M2 lacks most new fields and carries deprecated shapes (docs/vendor-gated-registration-flow.md § M2). Every field is read as optional; nothing throws on `undefined`, `null`, a missing array, or an array of the wrong type. Legacy fields (`vehicleRegistrations`, `staffPerDay`, `electricalEquipmentList`, `electricalLoad`, `gasEquipmentType`, `boothCount`, `hasPublicLiabilityInsurance`, `socialMediaHandle`) render in their natural section, labelled "(legacy)", only when present. Repeating tables render a defensive row mapper (non-object rows skipped).

## Layout
`PageShell` + `PageHeader` (title = businessName, subtitle = contactEmail, action = "Back to vendors" link to /admin/vendors). Sections as a vertical stack of cards using existing admin tokens (`border-rule`, `bg-parchment`, `font-serif` heading, label/value `dl`). Must not horizontally overflow at 390 and 1440. No new colours, fonts or tokens.

## Manual (not gated, no live writes)
After deploy to beta, an admin opens /admin/vendors, opens a row, follows "View full registration", and sees every heading above; an unauthenticated request redirects to /admin/login. Record in the QA report; do not script against live Firestore.

## Follow-ups to record in backlog (not this feature)
- Store `applicationId` on the submission at registration so the application link is exact.
- Signed-URL viewing of uploaded logo/photos/proof of payment.
- (e) stand size asked twice: needs Lee-Ann/Brad.

# registration-forms: one full registration form per symposium, WOSA conference and cocktail ticket

Status: reworked 16 Nov 2026 after Brad's review. Contract (16 assertions) and goldens written; dev only, nothing to main or beta until Brad approves on http://dev.saoc.co.za.
Source authority: docs/rules/no-invention.md. Unsourced items are in section 8.

## 1. Brad's rulings (16 Nov 2026)
1. Scope: SAOC Symposium, WOSA Conference and Cocktail evening tickets (saoc-symposium, wosa-conference, sunset-cocktails-single), flagged by a Sanity boolean `requiresRegistration`.
2. "If Leanne had it in the Excel document, put it in the form. Don't leave judges off." Every field and block in the sheet is on the form, every field required.
3. "The buyer completes the registration or the info collection when they click purchase tickets. It's not a separate registration document." The forms sit inside the ticket purchase and go in the same checkout POST.
4. "I selected three tickets for the symposium, then I get three forms to complete ... on forms two, three and onwards ... have a checkbox that says same as above and then that form section disappears."
5. Typos fixed ("identity document", "Independent Member"); "Halaal" kept. Dietary shown in admin and CSV only, never in the email or PDF.
6. Dev first. Ozow, payment, webhook, email and PDF code untouched.

## 2. Sources
Sheet "Symposium Registration form", id 1G6uAaoDDDFMD7bB5upxBtgiH3eN2q3ZyLi9XVBE6Sjs (tabs "Registration sheet", "Dropdown lists"), read 2026-11-16. Its sample entries are real personal details and are not copied anywhere; goldens use fictional data. Also her Questions doc item "Conference/Symposium Registration" and 13.1 Ticketing system details.docx.

## 3. Current flow (verified)
- One ticket type per buy page (components/tickets/TicketPurchaseForm.tsx, host app/(nos)/tickets/[slug]/page.tsx). Quantity stepper names "One fewer" / "One more", default quantity 1, max CART_MAX_LINE_ITEMS = MAX_LINE_ITEMS = 20. CartAttendeeFields renders one name + email row per unit.
- Client posts lineItems [{ticketType, attendeeName, attendeeEmail, chosenDay?}] to app/api/tickets/checkout/route.ts; parseLineItems (line 277) rejects the whole cart on a bad item; reserveTicket (line 1056) writes order and tickets via buildMultiReservationDocs (lib/checkout-reservation.ts:270); the browser then goes to Ozow. So the registration must ride the same POST.
- Ticket doc keys today: issuedInTestMode, bookingRef, showId, attendeeName, attendeeEmail, ticketType, status, amount, purchasedAt, checkedInAt, m_payment_id, pf_payment_id, orderId, compedBy, expiresAt, idempotencyKey, chosenDay.
- Cocktail couple SKU is retired; N cocktail tickets are quantity N of sunset-cocktails-single. Category cannot select cocktails (shared with workshops), hence the flag.

## 4. The form
Quantity N (1 to 20) gives N full forms, headed "Attendee 1" to "Attendee N" (each a role=group of that name). For flagged types the forms replace the per-attendee name and email rows. The sheet's "TRAVELING COMPANION INFORMATION" block is covered by attendee 2 and later each having their own full form; it is not rendered as a separate section and there is no Add spouse/partner control or 1-or-2 limit. Quantity 0 shows no forms (today's buy hint).

Full field list per attendee, in this order, labels from the sheet with typos fixed, all required. Options are in goldens/registration-fields.json.
- PERSONAL INFORMATION: Title (Mr, Mrs, Ms, Dr., Sir, Hon.); First Name (as per your identity document or passport); Surname (same suffix); Preferred name; Email address; Mobile Number (include country code); Country (196 countries, see 8.3); If South African, select Province (nine provinces; shown and required only when Country is South Africa, otherwise null).
- MEMBERSHIP: To which Society do you belong to? Multi-select, at least one; 25 options: None, 21 named societies, Wild Orchids of Southern Africa, Overseas visitor, Independent Member. "None" cannot be combined with another.
- NATIONAL SHOW BOOKING OPTIONS: Please select from the dropdown. The sheet's 14 options (Exhibit Entry - Early bird special / Friday / Saturday / Sunday, Weekend Pass, Sunset Cocktails, SAOC Symposium Early Bird / Normal Ticket / Speaker / Speaker Partner/Spouse, and the same four WOSA Symposium options). Pre-selected from the ticket being bought: saoc-symposium = SAOC Symposium Normal Ticket, wosa-conference = WOSA Symposium Normal Ticket, sunset-cocktails-single = Sunset Cocktails. Shown and locked (disabled): none of the other options can change what the cart sells, so editing it would be meaningless. The server rejects any other value for the ticket.
- JUDGES EVENTS (all six required, no skip rule; non-judges choose the sheet's own Not applicable): Are you an accredited Orchid Judge (Yes, No, Not applicable); With which Orchid Organisation (SAOC, AOS, Not applicable); Will you be available as a Show Judge at the Show (Yes, No, Not applicable); Which date would you be available? (22-Sep, 23-Sep, 22 & 23 Sept, None, Not applicable); Will you be attending the Judges Communication? (Yes, No, Not applicable); Will you be attending the Judges Forum? (Yes, No, Not applicable).
- DIETARY REQUIREMENTS: Please select from the drop down list (None, Vegetarian, Halaal).

Same as above (forms 2 and later; label verbatim "Same as above"). Two checkboxes per form, ids `registration-{n}-same-contact` and `registration-{n}-same-membership`:
- contact: Mobile Number, Country, Province. The sheet has no heading for this group, so no heading is invented; the checkbox is described by those three sheet labels. To keep the group contiguous Email is placed before Mobile (a swap versus the sheet).
- membership: the MEMBERSHIP section (society).
- Never shareable, always per person: Title, First Name, Surname, Preferred name, Email (each ticket goes to its own email), Attending, Judges Events, Dietary.
- Ticking hides the section and the client copies attendee 1's values in at submit. Unticking shows it again, empty and required. Form 1 has no checkboxes.

Look and feel: existing field components, tokens and the checkout-error-summary pattern only (one summary, per-field alert, focus). No new colours, fonts or visuals; society checkboxes follow the vendor-form checkbox pattern. Fixture route gains `?type=registration`: one static flagged type with the real slug saoc-symposium (test scaffold only, same guards as ?type=day).

## 5. Server and storage
- Sanity ticketType: optional boolean `requiresRegistration`, initialValue false (pattern of requiresAttendeeNames); selected in the checkout GROQ; set true on the three slugs by a content patch shipped with the change. TicketTypeCardData gains `requiresRegistration`.
- New client-safe lib/registration.ts exports REGISTRATION_OPTIONS (keys title, country, province, society, attending, judgeYesNoNa, judgeOrganisation, judgeDate, dietary, equal to the golden), `validateRegistrationGroup(people: unknown, ticketType: string)` returning `{ok:true, people}` or `{ok:false, errors}` (keys `people.<i>.<field>`, `quantity`, `ticketType`), and `buildRegistrationDoc(person)`.
- validateRegistrationGroup: array of 1 to 20 people (else `quantity`); ticketType must be one of the three slugs (else `ticketType`); `sameAsAttendee1` is absent or a list of `contact` and `membership`, and must be empty on person 1; listed sections are COPIED from person 1 server-side and any sent values are overwritten, unlisted sections must validate on their own; attendeeNumber is assigned 1..N; every other field required and validated against its list; province required iff country is South Africa and null otherwise; societies at least one, None exclusive; attending must equal the ticket's value; lengths names 100, mobile 30, email 254; email by the existing EMAIL_PATTERN; mobile digits, spaces, + - and brackets with 7 to 15 digits.
- Route: for a flagged ticket type every line item must carry `registration`; failure is a 400 before any Firestore write. attendeeName (first name, space, surname) and attendeeEmail (trimmed, lower-cased) are derived server-side. For unflagged types a sent registration is ignored. LineItemPlan gains optional `registration`; buildMultiReservationDocs writes `registration: buildRegistrationDoc(...)` only when present. Unflagged ticket docs and every order doc keep exactly today's keys.
- Stored on EVERY ticket doc of a flagged cart, keys in order: attendeeNumber, title, firstName, surname, preferredName, mobile, country, province (null if not South Africa), societies, attending, judgeAccredited, judgeOrganisation, judgeAvailable, judgeDate, judgeCommunication, judgeForum, dietary, sameAsAttendee1 (list of copied section ids, [] when none). Copied sections are stored as values. Email stays in attendeeEmail. Nulls, never undefined (docs/firestore-undefined-write-safety.md).

## 6. Admin and CSV
Admin ticket detail drawer (components/admin/TicketsTable.tsx, rows from app/admin/(shell)/tickets/page.tsx) shows Dietary, Mobile, Societies, Attendee number, Attending and the six Judges Events answers when present; not in table columns, not on the door screen. CSV header: the original six columns first, then dietary, mobile, societies, attendeeNumber, attending, judgeAccredited, judgeOrganisation, judgeAvailable, judgeDate, judgeCommunication, judgeForum. Confirmation email, ticket PDF and templates unchanged.

## 7. Untouched, blast radius, contract
Untouched: lib/ozow.ts, lib/payfast.ts, lib/payments/, lib/ozow-sandbox-test-mode*.ts, lib/payment-mode.ts, the itn, ozow-itn and ozow-sandbox-test-mode routes, capacity, price, pooling, reservation transaction shape; email, PDF, templates; all unflagged ticket types. Blast radius medium: every sale passes parseLineItems, the route and the doc builder; A5 (unflagged output identical, passes on the baseline) and A6/A7 are the guards.
Contract.yaml, 16 assertions: A1 wiring, A2 options, A3 40 validation cases, A4 stored shape, A5 unflagged identical, A6 payment paths untouched, A7 email/PDF/templates untouched, A8 e2e golden copied unchanged, A9 e2e (quantity 1 and 3, Same as above, blocked submits, three registrations in the POST), A10 CSV, A11 admin, A12 type-check, A13 lint, A14 codex_qa, A15 browser check on dev (pending until deployed), A16 gws (not applicable, non-required). Goldens: registration-fields.json, firestore-registration-shape.json, validation-cases.json, check_registration.mts, registration-form.spec.ts, check_untouched.sh, check_qa_out.sh. No automated test reaches the live route; A14's brief must probe 21 line items, a flagged item without registration, tampered Attending, and replay with duplicate emails.

## 8. Not sourced, assumptions to confirm, open gaps
1. Brad's rule 2 overrides Lee-Ann's own comment on JUDGES EVENTS ("irrelevant to the booking as all judges will correspond directly with Fiona via Nitsi"). Included as ruled; Lee-Ann may want to hear this.
2. The judge date options 22-Sep, 23-Sep and 22 & 23 Sept carry no year and are kept verbatim (the show is 23 to 26 Sept 2027).
3. Country list: blank row dropped, Russia de-duplicated, sorted A to Z, South Africa not moved to the top.
4. Reordering Email before Mobile, the contact group described by sheet labels (no sheet heading), "None" exclusive, mobile 7 to 15 digits, society as a checkbox group, "TRAVELING COMPANION INFORMATION" and "To which Society do you belong to?" kept or dropped as above.
5. Attending: the sheet's comment "Have the prices next to the copy" is not applied, since the field is locked and the cart shows the price. "WOSASymposium Normal Ticket" corrected. The locked value for each ticket (Normal Ticket, not Early Bird) follows Brad's earlier ruling of no early bird for conferences.
6. Admin and CSV show every registration answer (assumption: admin-only, as Brad ruled for dietary).
7. Duplicate emails across attendees: existing replay matching keys on ticketType plus email; to be probed by QA, not changed.
8. Open for Lee-Ann (questions already in her doc 16 Nov): kosher (Vegetarian or a separate option), privacy wording and retention. Her group-booking question is now answered by Brad's N-forms design. Still unasked: whether speaker and speaker-partner tickets are sold on the site, her two unanswered notes in the sheet, and accessibility requirements at cocktails (13.1 doc).

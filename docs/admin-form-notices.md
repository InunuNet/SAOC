# Admin form notices (mission admin-form-notices)

Two forms notify the admins by email once their submission is stored: the contact form and the
society event submission. Vendors, tickets and sponsor enquiries already notified; this closes
the remaining forms.

## What is sent

| form | route | stored in | notice subject | email |
|---|---|---|---|---|
| Contact (also the members suggestion form, same endpoint) | `POST /api/contact` | Firestore `contactSubmissions` | `New contact message — SAOC` | `emails/ContactSubmissionAdminNotice.tsx` |
| Society event submission | `POST /api/events/submit` | Sanity draft `drafts.societyEvent-<uuid>` (a `societyEvent` document, not Firestore) | `New event submission — SAOC` | `emails/EventSubmissionAdminNotice.tsx` |

Senders: `lib/contact-submission-admin-notice.ts` and `lib/event-submission-admin-notice.ts`,
both modelled on `lib/sponsor-enquiry-admin-notice.ts`. Both emails use EmailShell family C
with detail rows only.

- Contact rows: Submission ID, Name, Email address, Subject, Message, Submitted.
- Event rows: Draft ID, Title, Kind, Start date, End date, Venue, Location, Description,
  Host society ID, Submitted by (user ID), Submitted. Absent `endDate` and `hostSocietyId` read
  `Not given`.
- `Submitted:` is shown in SAST via `formatAdminDateTime`. The contact time is the stored
  `submittedAt`. The event draft stores no submit time, so the notice uses the send time.

## When

- Contact: after the Firestore `add()` and after the unchanged submitter acknowledgement, before
  the 201.
- Event: after `createIfNotExists` succeeds, before the 201.
- A failed write returns the existing 500 and sends nothing. Validation and auth failures send
  nothing.
- Each send runs inside `deliverConfirmationEmailAfterCommit` and failures are logged through
  `logFailureSafely` (operation and error type only), so a Resend outage or a throwing mailer
  never changes the HTTP response.
- A duplicate submission is two documents and two notices per recipient; no dedupe exists.

## To whom

Recipients come only from `ADMIN_EMAIL_ALLOWLIST` through `getAdminNotifyRecipients`
(`lib/admin-notify-recipients.ts`), lowercased and trimmed, never from the submitter. An empty
allowlist sends nothing and logs one non-PII warning.

## No links

Neither notice links anywhere: no admin listing page exists for contact messages or event
drafts, and none was invented. Notices carry the document id only.

## NOS and `/contact`

NOS has no contact path. `proxy.ts` redirects NOS `/contact` (308) to the SAOC origin and no NOS
page posts to `/api/contact`. Nothing was built for NOS. When a NOS `/contact` page later posts
to the same endpoint, these notices cover it unchanged. A `Site:` row would then be a one-line
follow-up using `siteForHost`; it is not added now.

## Out of scope

- D3: consent tick, honeypot, rate limiting and CAPTCHA on contact and event submit (separate
  mission).
- An admin listing or detail page for contact messages or event drafts.
- A submitter acknowledgement for event submissions; any change to `ContactConfirmation`.
- Newsletter notices; retries, queues or dedupe.

## Allowlist change (operator action, not code)

Adding `2027National@gmail.com` is a change to the `ADMIN_EMAIL_ALLOWLIST` secret in Secret
Manager (bound in `apphosting.yaml`), not a repo value. The notices work for any allowlist
value, so this code merges independently of the secret. Case does not matter; the helper
lowercases. The same list gates `/admin` login alongside the `admin` claim and a verified
email, so the address also becomes login-eligible, though it still needs the claim to get in.

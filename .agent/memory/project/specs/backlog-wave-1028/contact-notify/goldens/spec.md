# contact-notify: golden spec

Finding: the admin notice already exists on main (`lib/contact-submission-admin-notice.ts`, wired in
`app/api/contact/route.ts`, recipients via `getAdminNotifyRecipients`, an alias of
`getVendorAdminNotifyRecipients`). The backlog line "nothing tells anyone" is stale on that half. What is
still missing: no delivery status on the doc, and the visitor-email failure logs the raw error object
(`console.error(..., emailErr)`), which can carry a key or the message.

## Interface (pinned; the checks import it)

`lib/contact-delivery.ts`, pure, no firebase-admin, no process.env:

    export type ContactEmailOutcome = 'sent' | 'failed' | 'no_recipients';
    export interface ContactDeliveryStatus {
      visitor: 'sent' | 'failed' | null;
      admin: ContactEmailOutcome | null;
    }
    export interface ContactDeliveryDeps {
      sendAcknowledgement(): Promise<void>;
      sendAdminNotice(): Promise<'sent' | 'no_recipients'>;
      recordStatus(status: ContactDeliveryStatus): Promise<void>;
      logError(message: string, context: Record<string, string>): void;
    }
    export async function deliverContactEmails(input, deps): Promise<ContactDeliveryStatus>;

Behaviour:
1. Run the visitor acknowledgement and the admin notice independently (one failing never skips the other),
   each exactly once. Neither may throw out of the function.
2. A thrown send becomes `'failed'`; `sendAdminNotice` resolving `'no_recipients'` is kept as is.
3. On failure call `deps.logError(message, { operation, exceptionType })` with operation `visitor_email`,
   `admin_email` or `record_status`, exceptionType from `safeErrorType` (lib/safe-log.ts). The context holds
   those two keys only: no message text, no address, no name, no submission body.
4. Call `deps.recordStatus(status)` exactly once, after both sends. If it throws, log `record_status` and
   still return the computed status.

`sendContactSubmissionAdminNotice` changes its return type from `void` to `'sent' | 'no_recipients'`
(empty allowlist returns `'no_recipients'`, still emitting its existing non-PII warning). Subject, body and
recipients are untouched: the template restates the submitted fields only (no new copy).

`buildContactSubmissionDoc` adds `emailDelivery: { visitor: null, admin: null }` (null, never undefined).
Route: after `.add()`, call `deliverContactEmails` with deps wrapping the two existing senders and
`ref.update({ emailDelivery: status })`; `logError` maps onto `logFailureSafely`-style output. Response stays
201 `{ success: true }` whatever the email outcome. Remove the raw `console.error(..., emailErr)`.

## Out of scope
A committee-facing list view, retries, a resend button, and any new email copy.

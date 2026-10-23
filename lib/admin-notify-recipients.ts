/**
 * Neutral name for the admin notification recipient resolver. The implementation stays in
 * lib/vendor-admin-notify-recipients.ts, whose contract checks pin it (one `process.env` read, no
 * logging, never the `/admin` login boundary); this is the alias non-vendor senders import so they
 * do not read as vendor code. Same list, same parse, ADMIN_EMAIL_ALLOWLIST as a recipient list only.
 */
export { getVendorAdminNotifyRecipients as getAdminNotifyRecipients } from './vendor-admin-notify-recipients';

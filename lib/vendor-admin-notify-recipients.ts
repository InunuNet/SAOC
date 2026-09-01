/**
 * G1 (vendor-flow-notifications) -- shared recipient resolver for the three new admin-notice
 * senders. Reads `process.env.ADMIN_EMAIL_ALLOWLIST` with the exact same parse the `/admin`
 * login authorization module's private `parseAllowlist()` already uses (comma-split, trim,
 * lowercase, filter empty). This is the ONLY function in the new notification surface that
 * reads `process.env`.
 *
 * Deliberately NOT exported from, or added to, that login authorization module -- that module
 * is the live `/admin` login authorization boundary; a notification-recipient resolver has zero
 * authorization meaning and must not live inside, import from, or be imported by that boundary
 * (this file imports neither it nor the admin-roles module, and neither of those imports this
 * file). Reusing `ADMIN_EMAIL_ALLOWLIST`'s VALUE as a notification recipient list is safe;
 * reusing its ENFORCEMENT MEANING would not be. See
 * contracts/golden/vendor-flow-notifications/README.md "Recipients -- read-only reuse, never
 * gating, never a second roster".
 *
 * Contains no `console.*` call of any kind -- the resolved recipient list is never logged.
 */
export function getVendorAdminNotifyRecipients(): string[] {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? '';
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

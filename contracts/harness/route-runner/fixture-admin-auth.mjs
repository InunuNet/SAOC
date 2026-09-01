// Shared admin-auth fixture for every route-runner check/demo. Defaults to an authenticated,
// fully-capable admin session (unchanged from before) so every EXISTING check that never sets
// FIXTURE_ADMIN_DENIED keeps behaving exactly as it always has.
//
// contract-stand-payment-link-visibility (2026-09-01) adds the FIXTURE_ADMIN_DENIED=1 toggle
// so a check can, in the SAME process and against the SAME imported route handlers, exercise
// "no/invalid admin session" without a second harness. Read dynamically inside each function
// (not cached at module-load time) so a script can flip it between two calls the same way the
// existing checks already flip VENDOR_STAND_PAYMENT_TOKEN_SECRET.
export async function getAdminSession() {
  if (process.env.FIXTURE_ADMIN_DENIED === '1') {
    return { ok: false, reason: 'no-session' };
  }
  return { ok: true, decodedToken: { email: 'reviewer@saoc.co.za' } };
}
export function hasCapability() {
  return process.env.FIXTURE_ADMIN_DENIED !== '1';
}

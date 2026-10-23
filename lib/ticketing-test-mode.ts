// lib/ticketing-test-mode.ts
// Mission committee-testing F1 -- the single off switch for the "Testing only, not live"
// treatment (bar, pay notice, page titles, email subjects, PDF watermark). Client-safe: imports
// nothing and reads no env, so a blank variable, a failed Firestore read or a flag flip can never
// hide it. Going live is a reviewed code change: flip the constant below, together with the
// payment adapters (lib/payments/**) and the committee-testing contract.
const TICKETING_PAYMENTS_LIVE = false;

export function isTicketingTestMode(): boolean {
  return !TICKETING_PAYMENTS_LIVE;
}

export const TICKETING_TEST_BANNER_HEADLINE = 'Testing only, not live';
export const TICKETING_TEST_BANNER_SUBLINE = 'No real payment is taken';
export const TICKETING_TEST_TITLE_PREFIX = '[Testing only, not live]';

export function withTestSubjectPrefix(subject: string, testMode = isTicketingTestMode()): string {
  return testMode ? `${TICKETING_TEST_TITLE_PREFIX} ${subject}` : subject;
}

// Public NOS-host paths and the internal /national-show/* forms they rewrite to (usePathname()
// may report either). Matched on a segment boundary, never a string prefix.
const TICKETING_SURFACE_ROOTS = [
  '/tickets',
  '/vsp',
  '/conferences',
  '/workshops',
  '/wosa-conference',
  '/vendors/payment',
  '/national-show/tickets',
  '/national-show/conferences',
  '/national-show/workshops',
  '/national-show/wosa-conference',
  '/national-show/vendors/payment',
];

export function isTicketingSurfacePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return TICKETING_SURFACE_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
}

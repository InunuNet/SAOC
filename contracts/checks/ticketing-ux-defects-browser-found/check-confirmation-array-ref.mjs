// A4 — normalizeBookingRefParam() (app/(marketing)/tickets/confirmation/page.tsx, new
// exported pure function this contract's F2 adds) must treat a repeated `?ref=A&ref=B`
// query param (which Next.js hands the page as a real string[], not a string) the SAME
// way it already treats a missing/empty ref: fall through to '' — never crash.
//
// THE DEFECT, CONFIRMED LIVE AGAINST THE RUNNING DEV SERVER (not inferred from source)
// `page.tsx` currently types `searchParams` as `Promise<{ ref?: string }>` and calls
// `ref?.trim()` directly. That type is a LIE at runtime: a real browser hitting
// `/tickets/confirmation?ref=A&ref=B` gets `ref === ['A', 'B']` from Next.js, and
// `.trim` is not a function on an array. Verified with a real headless Chromium run
// against `http://localhost:3002/tickets/confirmation?ref=A&ref=B` while authoring this
// check: `page.on('pageerror')` fired `"ref?.trim is not a function"`, and the rendered
// body showed Next's dev error boundary ("This page couldn't load — A server error
// occurred"), HTTP status still 200 (the error boundary renders client-side in dev; a
// production build returns a real 500 for this route) — a public page one query-string
// character away from crashing for every visitor.
//
// WHY A PURE-FUNCTION CHECK, NOT A SECOND LIVE BROWSER RUN AGAINST THE PAGE ITSELF
// This project's own convention (contracts/checks/ticketing-multi-line-item-cart-ui/
// check-confirmation-shows-all-positions.mjs's header) is that genuinely live, rendered-
// page behaviour needs a real HTTP round trip, which an architect pass does not run
// against live Firestore/network. The CORRECT fix path, per this contract's F2, extracts
// the guard into a small, pure, zero-dependency exported function — the same "one bad
// input rejects/normalizes, nothing else runs" shape as parseLineItems() in the sibling
// contract-ticketing-multi-line-item-cart. Once bookingRef normalizes to '' for an array
// input, the page's own existing code path (`bookingRef.length > 0 ? await
// getConfirmedOrderForDisplay(bookingRef) : null`) never calls Firestore at all — so
// this function alone is the complete, testable surface of the fix; no live dependency
// is needed to prove it, and the page's already-correct not-found/poller rendering for
// an empty bookingRef is untouched by this contract (not re-proven here).
//
// Imports the function via a relative path (this project's convention for check scripts
// that need to avoid `@/`-alias resolution risk — see the sibling contract's own
// check-confirmation-shows-all-positions.mjs). Expected to fail with a module-resolution
// error until @dev adds the export per F2 — the standard "code does not exist yet" form
// of red this project's own contracts already use (contract-ticketing-multi-line-item-
// cart's README, "the expected, correct form of red for code that does not exist yet").
//
// Run as: npx tsx contracts/checks/ticketing-ux-defects-browser-found/check-confirmation-array-ref.mjs

import { normalizeBookingRefParam } from '../../../app/(marketing)/tickets/confirmation/page.tsx';

const failures = [];

function check(label, input, expected) {
  let actual;
  try {
    actual = normalizeBookingRefParam(input);
  } catch (err) {
    failures.push(`${label}: THREW instead of returning a value — ${err.message}`);
    return;
  }
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// THE CORE PROOF — the defeating case named explicitly by the architect brief: a
// repeated ?ref=A&ref=B, which Next.js hands the page as string[]. Must normalize to ''
// (the SAME fallback already used for a missing ref), never throw.
check('(1) array of two values (?ref=A&ref=B)', ['A', 'B'], '');

// A single-element array is still an array at the type level (Next.js can also produce
// this shape) — must not be treated as "safe because it only has one entry".
check('(2) single-element array (?ref=A, arriving as [\'A\'])', ['A'], '');

// Negative control — the genuinely working, already-shipped single-string case (today's
// only real shape) must be UNCHANGED: a real ref is trimmed and returned, not discarded.
check('(3) NEGATIVE CONTROL: normal single-string ref', 'REAL-BOOKING-REF-123', 'REAL-BOOKING-REF-123');

// Negative control — a single string with incidental whitespace must still be trimmed,
// exactly as `ref?.trim()` already did — proves the fix does not silently drop the
// existing trim behaviour while closing the array hole.
check('(4) NEGATIVE CONTROL: single-string ref with whitespace', '  REAL-REF  ', 'REAL-REF');

// Missing ref (undefined) — today's other already-working empty-fallback path.
check('(5) missing ref (undefined)', undefined, '');

// Empty string ref — today's other already-working empty-fallback path.
check('(6) empty string ref', '', '');

// Empty array — the emptiest possible "array, not a string" shape.
check('(7) empty array', [], '');

console.log(failures.length === 0 ? 'All cases passed.' : `${failures.length} case(s) failed.`);

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
process.exit(0);

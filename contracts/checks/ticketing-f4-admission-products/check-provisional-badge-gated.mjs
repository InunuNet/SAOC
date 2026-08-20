// A9 — components/tickets/TicketTypeCard.tsx must render a REAL, visible provisional marker
// (actual text content, not a CSS-only treatment) ONLY when TicketTypeCardData.provisional is
// true. Proven offline with real react-dom/server output against both a `provisional: true` and
// a `provisional: false` fixture in the SAME run — the negative control is what rules out a
// hardcoded-always-on badge, which is the cheapest way to look done and be wrong the day the
// council confirms prices (see golden README "UI: provisional badge is flag-gated, observably").
//
// This check imports a `provisional` prop that does not exist on TicketTypeCardData on the
// current tree — expected to fail (TypeScript would reject it; this JS-level check will render
// the current component and find NO badge text in either case, since there is nothing gating on
// yet) until @dev adds the field and the conditional render per this contract's brief.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-admission-products/check-provisional-badge-gated.mjs

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { TicketTypeCard } from '../../../components/tickets/TicketTypeCard.tsx';

const failures = [];
const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// A marker is any real, human-readable text containing "provisional" (case-insensitive) —
// deliberately loose on exact copy (that's @dev's call per the golden README) but strict on it
// being present in the STRIPPED TEXT CONTENT, not just an attribute/class name that a screen
// reader or this check's stripTags() would never see.
function hasProvisionalMarker(html) {
  return /provisional/i.test(stripTags(html));
}

const baseProps = {
  quantity: 0,
  onQuantityChange: () => {},
  soldOutLabel: 'Sold out',
  decreaseLabel: 'Decrease',
  increaseLabel: 'Increase',
};

// --- provisional: true -> badge/marker text must be present ---
const provisionalHtml = renderToStaticMarkup(
  React.createElement(TicketTypeCard, {
    ...baseProps,
    ticketType: {
      slug: 'early-bird',
      name: 'Early-Bird Exhibition Ticket',
      price: 130,
      description: 'One-day admission at the early-bird rate.',
      soldOut: false,
      provisional: true,
    },
  })
);
if (!hasProvisionalMarker(provisionalHtml)) {
  failures.push(
    `provisional: true must render a real "provisional" text marker; rendered text was: ` +
      `"${stripTags(provisionalHtml)}"`
  );
}

// --- provisional: false -> NO marker text (negative control) ---
const confirmedHtml = renderToStaticMarkup(
  React.createElement(TicketTypeCard, {
    ...baseProps,
    ticketType: {
      slug: 'day-visitor',
      name: 'Day Visitor Ticket',
      price: 150,
      description: 'Single-day admission.',
      soldOut: false,
      provisional: false,
    },
  })
);
if (hasProvisionalMarker(confirmedHtml)) {
  failures.push(
    `provisional: false must NOT render a "provisional" text marker (negative control — rules ` +
      `out a hardcoded-always-on badge); rendered text was: "${stripTags(confirmedHtml)}"`
  );
}

// --- price/name still render correctly regardless of the flag (the flag must not suppress the
// rest of the card) ---
if (!stripTags(provisionalHtml).includes('Early-Bird Exhibition Ticket')) {
  failures.push('provisional card no longer renders the ticket type name.');
}
if (!stripTags(confirmedHtml).includes('Day Visitor Ticket')) {
  failures.push('confirmed (non-provisional) card no longer renders the ticket type name.');
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: TicketTypeCard renders a real provisional marker gated on provisional===true, in both directions.');

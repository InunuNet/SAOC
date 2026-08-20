// A9 — components/tickets/CartDayPicker.tsx (F5 of this contract) must render an ENTIRELY
// showDays-prop-driven set of day options, and must render NOTHING for a ticket type whose
// requiresDaySelection is false. Offline proof via react-dom/server (no browser) — same
// technique contracts/checks/ticketing-f4-admission-products/
// check-provisional-badge-gated.mjs already established for the provisional badge.
//
// THE DEFECT CLASS THIS TARGETS
// A day-picker that "looks done" the cheapest way renders SOME days, satisfying a single
// fixture, without those days actually coming from showDays — e.g. a hardcoded list, or one
// captured once and never re-read. This check renders the SAME component with two disjoint
// synthetic showDays arrays and requires the rendered option values to differ and to exactly
// match each array — the negative control a single-fixture render cannot provide. It also
// renders a requiresDaySelection: false ticket type in the SAME run to prove the picker doesn't
// render unconditionally regardless of the flag.
//
// This check imports a component that does not exist on the current tree — expected to fail
// with a module-resolution error until @dev adds components/tickets/CartDayPicker.tsx per this
// contract's brief.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f5-day-attendees/check-day-picker-ui-gated.mjs

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { CartDayPicker } from '../../../components/tickets/CartDayPicker.tsx';

const failures = [];

const dayVisitorType = {
  slug: 'day-visitor',
  name: 'Day Visitor Ticket',
  price: 150,
  description: 'Single-day admission.',
  soldOut: false,
  provisional: true,
  requiresDaySelection: true,
};

const weekendPassType = {
  slug: 'weekend-pass',
  name: 'Weekend Pass',
  price: 400,
  description: 'Full-weekend admission.',
  soldOut: false,
  provisional: true,
  requiresDaySelection: false,
};

// Deliberately synthetic, disjoint, far-future day arrays — never the real placeholder range.
const showDaysA = ['2099-01-01', '2099-01-02', '2099-01-03'];
const showDaysB = ['2098-11-05', '2098-11-06'];

function render(showDays) {
  return renderToStaticMarkup(
    React.createElement(CartDayPicker, {
      ticketTypes: [dayVisitorType, weekendPassType],
      quantities: { 'day-visitor': 1, 'weekend-pass': 1 },
      showDays,
      chosenDayByType: { 'day-visitor': [''], 'weekend-pass': [] },
      errors: {},
      disabled: false,
      onChosenDayChange: () => {},
    })
  );
}

const markupA = render(showDaysA);
const markupB = render(showDaysB);

function optionValuesPresent(markup, days) {
  return days.every((day) => markup.includes(`value="${day}"`));
}

// (1) Every day in showDaysA appears as an option value when rendered with showDaysA.
if (!optionValuesPresent(markupA, showDaysA)) {
  failures.push(`(1) not every showDaysA entry (${showDaysA.join(', ')}) appeared as an option value in the rendered markup.`);
}

// (2) Every day in showDaysB appears as an option value when rendered with showDaysB.
if (!optionValuesPresent(markupB, showDaysB)) {
  failures.push(`(2) not every showDaysB entry (${showDaysB.join(', ')}) appeared as an option value in the rendered markup.`);
}

// (3) CORE NEGATIVE CONTROL: showDaysA's days must NOT appear when rendered with showDaysB —
// rules out a hardcoded/leftover day list.
if (showDaysA.some((day) => markupB.includes(`value="${day}"`))) {
  failures.push('(3) CORE DEFECT: a showDaysA day leaked into the showDaysB render — the option list is not purely driven by the showDays prop.');
}

// (4) The two renders must produce genuinely different markup.
if (markupA === markupB) {
  failures.push('(4) CORE DEFECT: rendering with two different showDays arrays produced IDENTICAL markup.');
}

// (5) No day-picker control at all for the requiresDaySelection: false ticket type — its
// price/name must not be accompanied by any of showDays's date values attributed to IT. Proven
// by rendering weekend-pass ALONE with a showDays list and confirming no date option renders.
const weekendOnlyMarkup = renderToStaticMarkup(
  React.createElement(CartDayPicker, {
    ticketTypes: [weekendPassType],
    quantities: { 'weekend-pass': 1 },
    showDays: showDaysA,
    chosenDayByType: { 'weekend-pass': [] },
    errors: {},
    disabled: false,
    onChosenDayChange: () => {},
  })
);
if (showDaysA.some((day) => weekendOnlyMarkup.includes(`value="${day}"`))) {
  failures.push('(5) CORE DEFECT: a day option rendered for a ticket type whose requiresDaySelection is false.');
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: CartDayPicker renders options driven entirely by the showDays prop, and renders nothing for a requiresDaySelection: false type.');

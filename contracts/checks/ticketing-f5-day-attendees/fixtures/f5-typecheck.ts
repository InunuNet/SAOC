// ticketing-f5-day-attendees (architect contract) — compiler-driven (not source-grep) proof of
// the new F5 exported shapes. Companion to the runtime checks (A3/A4/A5/A7/A8/A9), which prove
// BEHAVIOUR and DATA; this proves the TYPES those are pinned to.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f5-day-attendees/tsconfig.typecheck.json

import type { ShowWindow } from '../../../../lib/admin-auth';
import { computeShowDays, isValidChosenDay } from '../../../../lib/show-window-lookup';

import { isNamedAttendeeSatisfied } from '../../../../lib/checkout-reservation';

import type { TicketTypeCardData } from '../../../../components/tickets/TicketTypeCard';

// --- computeShowDays()/isValidChosenDay() accept a ShowWindow and return the documented shapes ---

const window: ShowWindow = {
  startDate: new Date('2099-01-01T00:00:00.000Z'),
  endDate: new Date('2099-01-04T00:00:00.000Z'),
};

const days: string[] = computeShowDays(window);
void days;

const valid: boolean = isValidChosenDay('2099-01-02', window);
void valid;

// --- isNamedAttendeeSatisfied() accepts (boolean, string) and returns boolean ---

const satisfied: boolean = isNamedAttendeeSatisfied(true, 'Alex Chen');
void satisfied;
const satisfiedNotRequired: boolean = isNamedAttendeeSatisfied(false, '');
void satisfiedNotRequired;

// --- TicketTypeCardData carries requiresDaySelection ---

const cardData: TicketTypeCardData = {
  slug: 'day-visitor',
  name: 'Day Visitor Ticket',
  price: 150,
  description: 'Single-day admission.',
  soldOut: false,
  provisional: true,
  requiresDaySelection: true,
};
void cardData;

// @ts-expect-error — TicketTypeCardData must require `requiresDaySelection` (no accidental
// optionality that would let the day-picker gate silently degrade to "never render").
const cardDataMissingRequiresDaySelection: TicketTypeCardData = {
  slug: 'weekend-pass',
  name: 'Weekend Pass',
  price: 400,
  description: 'Full-weekend admission.',
  soldOut: false,
  provisional: true,
};
void cardDataMissingRequiresDaySelection;

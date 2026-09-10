/**
 * ticketing-complete (M1/F1) -- pure ticket-category taxonomy. See
 * .agent/memory/project/specs/ticketing-complete/goldens/README.md for the full decision
 * record and .../goldens/fixtures/f1-taxonomy.json for the golden truth table this mirrors
 * verbatim.
 *
 * `TicketCategory` is a NEW, finer classification layer sitting ABOVE the existing 3-value
 * Sanity `ticketType.category` enum (`admission` | `conference` | `workshop-field-trip`),
 * which already gates which public page a ticketType document appears on. This module does
 * not replace that enum -- `TICKET_CATEGORY_PURCHASE_SURFACE` maps each of the 7 fine-grained
 * categories onto it.
 *
 * Pure, dependency-free: no Firestore, no Sanity client, no network, no implicit clock.
 */

export const TICKET_CATEGORIES = [
  'admission',
  'exhibitor',
  'workshop',
  'field-trip',
  'symposium',
  'wosa-conference',
  'cocktail-reception',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  admission: 'Admission',
  exhibitor: 'Exhibitor Entry',
  workshop: 'Workshop',
  'field-trip': 'Field Trip',
  symposium: 'SAOC Symposium',
  'wosa-conference': 'WOSA Conference',
  'cocktail-reception': 'Cocktail / Reception',
};

/** The existing Sanity `ticketType.category` enum this taxonomy sits above. */
export type TicketTypePurchaseSurface = 'admission' | 'conference' | 'workshop-field-trip';

/**
 * Exhibitor entry: deliberately unresolved. Exhibitor Entry's real purchase surface is
 * `/national-show/exhibitors`, inside `app/(marketing)/national-show/**` -- a tree this
 * mission is barred from touching (F5's negotiated boundary). Which of the 3 schema
 * `category` values (if any) an exhibitor `ticketType` document should carry is genuinely
 * undecided pending F5's component-API handoff. This is an EXPLICIT literal, never a silent
 * default to `'admission'` or any other schema value -- a silent default here would be
 * exactly the kind of invented eligibility relationship this mission's anti-fabrication
 * constraint targets.
 */
export const EXHIBITOR_PURCHASE_SURFACE_UNRESOLVED = 'unresolved-nos-boundary' as const;

export const TICKET_CATEGORY_PURCHASE_SURFACE: Record<
  TicketCategory,
  TicketTypePurchaseSurface | typeof EXHIBITOR_PURCHASE_SURFACE_UNRESOLVED
> = {
  admission: 'admission',
  exhibitor: EXHIBITOR_PURCHASE_SURFACE_UNRESOLVED,
  workshop: 'workshop-field-trip',
  'field-trip': 'workshop-field-trip',
  symposium: 'conference',
  'wosa-conference': 'conference',
  'cocktail-reception': 'workshop-field-trip',
};

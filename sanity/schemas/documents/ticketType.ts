import { defineField, defineType } from 'sanity';

// F1 (ticketing-pages): the council's real ticket categories (adult, pensioner, child,
// SAOC member, exhibitor), replacing the hardcoded PLACEHOLDER_TICKET_PRICES map that
// used to live in app/api/tickets/checkout/route.ts. Exactly these seven fields — no
// provisional/status field invented on top; "provisional" pricing is communicated via
// the description text until the council confirms real prices (see scripts/seed-ticketing.ts).
export const ticketType = defineType({
  name: 'ticketType',
  title: 'Ticket Type',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name' },
    }),
    defineField({
      name: 'price',
      title: 'Price (ZAR)',
      type: 'number',
      // No .integer() — ZAR prices may carry cents.
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({
      name: 'capacity',
      title: 'Capacity',
      type: 'number',
      description:
        'Required. Enforced again at checkout — a ticket type with no capacity cannot be sold.',
      validation: (Rule) => Rule.required().integer().min(0),
    }),
    defineField({ name: 'active', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({ name: 'order', title: 'Display Order', type: 'number' }),
    // F1 (ticketing-foundation): which sales-capable `show` this ticket type belongs
    // to. Required for new documents; the 5 pre-existing published documents predate
    // this field and are backfilled by scripts/migrate-show-sales-fields.ts. See
    // contracts/golden/ticketing-f1-show-collision/README.md.
    defineField({
      name: 'show',
      title: 'Show',
      type: 'reference',
      to: [{ type: 'show' }],
      options: { filter: 'active == true' },
      validation: (Rule) => Rule.required(),
    }),
    // F9 (ticketing-foundation): additive marker field. Optional/defaulted so the 5
    // pre-existing published ticketType documents remain valid without a migration.
    defineField({
      name: 'demo',
      title: 'Demo / Test Ticket Type',
      type: 'boolean',
      initialValue: false,
      description:
        'Marks this as test data — never real pricing. Excluded from the public /tickets ' +
        'listing and identifiable in Firestore purchase records via its reserved slug. See ' +
        'contracts/golden/ticketing-f9-demo-ticket/README.md.',
    }),
    // F4 (multi-line-item-cart, M2): machine-readable provisional flag — replaces the F1
    // prose-only "Provisional price — pending council confirmation." description string as
    // the ONLY provisional signal, so the /tickets UI can gate a real conditional on it. The
    // existing `description` field is unaffected — the two are complementary. See
    // contracts/golden/ticketing-f4-admission-products/README.md.
    defineField({
      name: 'provisional',
      title: 'Provisional',
      type: 'boolean',
      initialValue: true,
      description:
        'True while this price/capacity is a web-team estimate, not council-confirmed. ' +
        'Gates a visible "provisional" marker on the public /tickets page.',
    }),
    // F4: optional early-bird window. Null/unset means no early-bird restriction applies.
    defineField({
      name: 'earlyBirdCutoff',
      title: 'Early-Bird Cutoff',
      type: 'datetime',
      description: 'Last day this ticket type is on sale at its early-bird rate. Optional.',
    }),
    // F4: staged-release lever, conceptually distinct from `capacity` (see golden README
    // "releasedQuantity: why it's a field at all"). Deliberately NOT required — most
    // products never set it — and 0 is a valid, real value (not "unset").
    defineField({
      name: 'releasedQuantity',
      title: 'Released Quantity',
      type: 'number',
      description:
        'How many of this ticket type\'s capacity are currently released for sale. Leave ' +
        'unset to release the full capacity. 0 is a valid value (not yet released).',
      validation: (Rule) => Rule.integer().min(0),
    }),
    defineField({
      name: 'requiresDaySelection',
      title: 'Requires Day Selection',
      type: 'boolean',
      initialValue: false,
      description: 'True for products (e.g. Day Visitor) where the buyer must choose a day.',
    }),
    defineField({
      name: 'requiresAttendeeNames',
      title: 'Requires Attendee Names',
      type: 'boolean',
      initialValue: false,
      description: 'True for products (e.g. VIP) that must capture a named attendee.',
    }),
    // F3 (ticketing-conferences-and-events, M2): which purchase page this ticket type
    // belongs on. Required for new documents, no default `initialValue` — matching the
    // `show` field's precedent above: a silent wrong-category default is worse than a
    // Studio validation error forcing a conscious choice. The 15 pre-existing documents
    // predate this field and are backfilled by scripts/migrate-ticket-type-category.ts.
    // See contracts/golden/ticketing-purchase-pages-f3/README.md.
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Admission', value: 'admission' },
          { title: 'Conference', value: 'conference' },
          { title: 'Workshop / Field Trip', value: 'workshop-field-trip' },
        ],
      },
      description: 'Which purchase page this ticket type is sold on.',
      validation: (Rule) => Rule.required(),
    }),
  ],
});

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
  ],
});

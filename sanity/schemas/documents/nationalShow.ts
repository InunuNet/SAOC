import { defineField, defineType } from 'sanity';

export const nationalShow = defineType({
  name: 'nationalShow',
  title: 'National Show',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'showDate', title: 'Show Date', type: 'datetime' }),
    defineField({ name: 'location', title: 'Location', type: 'string' }),
    defineField({ name: 'hero', title: 'Hero Image', type: 'image' }),
    defineField({ name: 'countdownDate', title: 'Countdown Target Date', type: 'datetime' }),
    defineField({ name: 'exhibitorStages', title: 'Exhibitor Stages', type: 'portableText' }),
    // F1 (ticketing-pages): functional gate, not copy — defaults CLOSED because real
    // prices are not yet council-approved. The message shown alongside this state
    // lives on ticketsPage.salesClosedMessage, not here — one place for an editor to
    // change wording, not two documents that can drift out of sync. See
    // contracts/golden/ticketing-m1-m2/content-vs-money-boundary.golden.md.
    defineField({
      name: 'salesOpen',
      title: 'Ticket Sales Open',
      type: 'boolean',
      initialValue: false,
      description:
        'Defaults CLOSED. Real prices are not yet council-approved — do not flip this on ' +
        'without checking with Lee-Ann/the council first.',
    }),
  ],
});

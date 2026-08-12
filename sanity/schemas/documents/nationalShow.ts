import { defineField, defineType } from 'sanity';

export const nationalShow = defineType({
  name: 'nationalShow',
  title: 'National Show',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'showDate', title: 'Show Date', type: 'datetime' }),
    // F6 (show-visitor-info): a single showDate cannot express a date range, which is
    // exactly why the landing page's Dates cell stayed a hardcoded literal. This is the
    // missing half, not a replacement — showDate itself is unchanged.
    defineField({
      name: 'showEndDate',
      title: 'Show End Date',
      type: 'datetime',
      description: 'The last day of the show. Together with Show Date this drives the hero date range.',
    }),
    defineField({
      name: 'edition',
      title: 'Edition Number',
      type: 'number',
      description:
        'e.g. 19 for the nineteenth show. Rendered as a roman numeral in the hero eyebrow and ' +
        'used in the closing call to action.',
      validation: (Rule) => Rule.integer().positive(),
    }),
    defineField({
      name: 'hostRegion',
      title: 'Host Region',
      type: 'string',
      description: 'The host province or region, shown in the hero meta grid.',
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      description:
        'Short display string for the hero. Authoritative venue detail lives in the Venue ' +
        'object below — keep the two consistent when the committee confirms the venue.',
    }),
    // F1 (show-visitor-info): THE single source for every venue-derived value the site
    // renders. Placed immediately after `location` so an editor sees the legacy display
    // string and the structured object adjacent to each other.
    // See contracts/golden/show-visitor-info/venue-single-source.golden.md.
    defineField({
      name: 'venue',
      title: 'Venue',
      type: 'showVenue',
      description:
        'The single source for every venue detail the website shows. Changing the venue means ' +
        'editing this object — nothing in the code needs to change.',
    }),
    defineField({ name: 'hero', title: 'Hero Image', type: 'image' }),
    defineField({ name: 'countdownDate', title: 'Countdown Target Date', type: 'datetime' }),
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

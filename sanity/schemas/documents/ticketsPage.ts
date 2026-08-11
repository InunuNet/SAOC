import { defineField, defineType } from 'sanity';

// F1 (ticketing-pages): page-singleton holding EVERY piece of visible copy across
// /tickets, /tickets/confirmation and /tickets/cancelled — same pattern as
// homePage/aboutPage/judgingPage/contactPage. Plain string/text fields on purpose:
// this is short informational copy, not long-form body content (contrast with
// judgingPage.intro, which correctly uses portableText). See
// contracts/golden/ticketing-m1-m2/ticketsPage-schema.golden.json.
export const ticketsPage = defineType({
  name: 'ticketsPage',
  title: 'Tickets Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Buy Page Title', type: 'string' }),
    defineField({ name: 'intro', title: 'Buy Page Intro', type: 'text' }),
    defineField({ name: 'buyButtonLabel', title: 'Buy Button Label', type: 'string' }),
    defineField({
      name: 'soldOutMessage',
      title: 'Sold Out Message',
      type: 'string',
      description: 'Shown as a per-type badge and in the all-sold-out banner.',
    }),
    defineField({
      name: 'salesClosedMessage',
      title: 'Sales Closed Message',
      type: 'text',
      description: 'Shown on /tickets while nationalShow.salesOpen is false.',
    }),
    defineField({ name: 'termsNote', title: 'Terms / Refund / Door-Entry Note', type: 'text' }),
    defineField({
      name: 'confirmationPendingHeading',
      title: 'Confirmation — Pending Heading',
      type: 'string',
    }),
    defineField({
      name: 'confirmationPendingMessage',
      title: 'Confirmation — Pending Message',
      type: 'text',
    }),
    defineField({
      name: 'confirmationSuccessHeading',
      title: 'Confirmation — Success Heading',
      type: 'string',
    }),
    defineField({
      name: 'confirmationSuccessMessage',
      title: 'Confirmation — Success Message',
      type: 'text',
    }),
    defineField({
      name: 'confirmationNotFoundMessage',
      title: 'Confirmation — Not Found Message',
      type: 'text',
    }),
    defineField({
      name: 'ticketIncludesNote',
      title: 'What Your Ticket Includes',
      type: 'text',
      description: 'Shown on the confirmation success state.',
    }),
    defineField({ name: 'cancelledHeading', title: 'Cancelled — Heading', type: 'string' }),
    defineField({ name: 'cancelledMessage', title: 'Cancelled — Message', type: 'text' }),
    defineField({
      name: 'cancelledButtonLabel',
      title: 'Cancelled — Button Label',
      type: 'string',
    }),
  ],
});

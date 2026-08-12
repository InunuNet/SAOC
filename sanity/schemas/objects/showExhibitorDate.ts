import { defineField, defineType } from 'sanity';

// F1 (show-exhibitor-info): one row of the exhibitor key-dates table.
//
// THE MOST IMPORTANT TYPE DECISION IN THIS SCHEMA: `dateNote` is a STRING.
//
// A calendar-typed field must hold a real calendar value. There is no honestly-empty
// one that still renders as a row in a dates table, so using that type here would force
// us to invent a staging deadline — and an invented deadline renders as fact no matter
// what marker sits beside it. A reader scanning for a cut-off absorbs the number, not
// the badge. A string reading "To be set by the show committee" cannot be misread that
// way.
//
// COST, ACCEPTED: no sorting, no countdown, no calendar export from these rows. Once the
// committee supplies real values, adding a parallel optional calendar field is a small
// follow-up — and safe at that point, because the values will be real.
// See contracts/golden/show-exhibitor-info/showExhibitorInfo-schema.golden.json.

const STATUS_OPTIONS = [
  { title: 'Pending — placeholder, the show committee must supply this', value: 'pending' },
  { title: 'Research — verified international show practice, not SAOC policy', value: 'research' },
  { title: 'Question — the research could not establish this', value: 'question' },
  { title: 'Confirmed — signed off by the show committee', value: 'confirmed' },
];

export const showExhibitorDate = defineType({
  name: 'showExhibitorDate',
  title: 'Exhibitor Key Date',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'What the row is for, e.g. "Entries close" or "Staging opens".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'dateNote',
      type: 'string',
      title: 'When',
      description:
        'Free text on purpose, so an unset value can be written honestly rather than guessed. ' +
        'Leave it as the committee-to-confirm wording until the show committee sets a real value.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'detail',
      title: 'Detail',
      type: 'text',
      rows: 2,
      description: 'What the exhibitor has to have done by then.',
    }),
    defineField({
      name: 'status',
      title: 'Confirmation Status',
      type: 'string',
      options: { list: STATUS_OPTIONS },
      initialValue: 'pending',
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'dateNote' },
  },
});

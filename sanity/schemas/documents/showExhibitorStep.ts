import { defineField, defineType } from 'sanity';

// F1 (show-exhibitor-info): one stage of the exhibitor journey — decide, enter, prepare,
// stage, judging, show days, removal.
//
// A document type rather than an array on showExhibitorInfo, for the same reason the
// visitor stream made showFaq a collection: the number of stages is exactly the thing
// the show committee is most likely to change (research section 2 — staging windows vary
// from a single afternoon to two days depending on show size). A document gives each step
// its own Studio URL, its own edit history, and its own confirmation status the committee
// can flip one at a time.
//
// This type RETIRES nationalShow.exhibitorStages as the source of exhibitor-journey
// content. Deleting that field is booked as FU-2 — it is owned by another stream and a
// sibling contract currently asserts it still exists.
// See contracts/golden/show-exhibitor-info/showExhibitorStep-schema.golden.json.

const STATUS_OPTIONS = [
  { title: 'Pending — placeholder, the show committee must supply this', value: 'pending' },
  { title: 'Research — verified international show practice, not SAOC policy', value: 'research' },
  { title: 'Question — the research could not establish this', value: 'question' },
  { title: 'Confirmed — signed off by the show committee', value: 'confirmed' },
];

export const showExhibitorStep = defineType({
  name: 'showExhibitorStep',
  title: 'Show Exhibitor Step',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'when',
      title: 'When',
      type: 'string',
      description:
        'Free text, not a calendar value — for the same reason a key-date row is free text. ' +
        'e.g. "By the published entry deadline".',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description:
        'Sort position, ascending. Seeded in tens so a step can be inserted between two others ' +
        'without renumbering everything.',
      validation: (Rule) => Rule.required().integer(),
    }),
    defineField({
      name: 'status',
      title: 'Confirmation Status',
      type: 'string',
      options: { list: STATUS_OPTIONS },
      initialValue: 'pending',
    }),
    defineField({
      name: 'active',
      title: 'Show on the site',
      type: 'boolean',
      initialValue: true,
      description: 'Uncheck to retire a step without deleting its edit history.',
    }),
  ],
  orderings: [
    {
      title: 'Journey order',
      name: 'journeyOrder',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'when' },
  },
});

import { defineField, defineType } from 'sanity';

// F1 (show-exhibitor-info): one open question for the show committee.
//
// Research section 12 is an explicit list of things the survey could NOT establish.
// Those are neither invented placeholders nor verified findings, and filing them as
// either would misrepresent them. They are published here as questions so an exhibitor
// can see what is genuinely undecided, and so the committee can read its own to-do list.
//
// `context` is what stops a question reading as ignorance rather than diligence: it says
// what was looked for and what was found.
// See contracts/golden/show-exhibitor-info/research-to-copy-map.golden.md.

const TOPIC_OPTIONS = [
  { title: 'Deadlines', value: 'deadlines' },
  { title: 'Fees', value: 'fees' },
  { title: 'Eligibility', value: 'eligibility' },
  { title: 'Display build', value: 'display-build' },
  { title: 'Sales', value: 'sales' },
  { title: 'Security', value: 'security' },
  { title: 'Watering and care', value: 'watering' },
  { title: 'Loading and access', value: 'loading' },
  { title: 'Insurance and liability', value: 'insurance' },
  { title: 'Results notification', value: 'results-notification' },
  { title: 'Permits', value: 'permits' },
  { title: 'Past SAOC precedent', value: 'precedent' },
];

export const exhibitorQuestion = defineType({
  name: 'exhibitorQuestion',
  title: 'Question for the Show Committee',
  type: 'object',
  fields: [
    defineField({
      name: 'question',
      title: 'Question',
      type: 'text',
      rows: 2,
      description: 'Phrased as a question TO the show committee, not as an answer to the exhibitor.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'context',
      title: 'Why we are asking',
      type: 'text',
      rows: 3,
      description: 'What the research looked for and what it did or did not find.',
    }),
    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'string',
      options: { list: TOPIC_OPTIONS },
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Sort position. Lower first.',
    }),
  ],
  preview: {
    select: { title: 'question', subtitle: 'topic' },
  },
});

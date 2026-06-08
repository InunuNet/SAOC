import { defineField, defineType } from 'sanity';

export const judgingPage = defineType({
  name: 'judgingPage',
  title: 'Judging Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'intro', title: 'Intro', type: 'portableText' }),
    defineField({ name: 'howItWorks', title: 'How It Works', type: 'portableText' }),
    defineField({
      name: 'stats',
      title: 'Stats',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', type: 'string', title: 'Label' },
            { name: 'value', type: 'string', title: 'Value' },
          ],
        },
      ],
    }),
    defineField({ name: 'becomingAJudge', title: 'Becoming a Judge', type: 'portableText' }),
    defineField({
      name: 'judges',
      title: 'Judges',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'judge' }] }],
    }),
    defineField({ name: 'showPublicDirectory', title: 'Show Public Directory', type: 'boolean' }),
  ],
});

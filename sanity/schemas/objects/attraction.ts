import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): things to do near the venue. No venue-derived value is
// hardcoded anywhere — distances live in the editable note text.
export const attraction = defineType({
  name: 'attraction',
  title: 'Nearby Attraction',
  type: 'object',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'note', title: 'Note', type: 'text' }),
    defineField({ name: 'url', title: 'Website', type: 'url' }),
  ],
  preview: {
    select: { title: 'name' },
  },
});

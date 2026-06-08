import { defineField, defineType } from 'sanity';

export const event = defineType({
  name: 'societyEvent',
  title: 'Event',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'date', title: 'Date', type: 'datetime' }),
    defineField({ name: 'endDate', title: 'End Date', type: 'datetime' }),
    defineField({ name: 'kind', title: 'Kind', type: 'string' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'venue', title: 'Venue', type: 'string' }),
    defineField({
      name: 'hostSociety',
      title: 'Host Society',
      type: 'reference',
      to: [{ type: 'society' }],
    }),
    defineField({ name: 'location', title: 'Location', type: 'string' }),
    defineField({ name: 'isFeatured', title: 'Featured', type: 'boolean' }),
  ],
});

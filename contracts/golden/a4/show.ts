import { defineField, defineType } from 'sanity';

export const show = defineType({
  name: 'show',
  title: 'Show',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
    }),
    defineField({ name: 'year', title: 'Year', type: 'number' }),
    defineField({ name: 'date', title: 'Date', type: 'datetime' }),
    defineField({ name: 'location', title: 'Location', type: 'string' }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: { list: ['past', 'upcoming', 'cancelled'] },
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({ name: 'entries', title: 'Entries', type: 'number' }),
    defineField({ name: 'exhibitors', title: 'Exhibitors', type: 'number' }),
    defineField({ name: 'awards', title: 'Awards', type: 'number' }),
    defineField({ name: 'summary', title: 'Summary', type: 'portableText' }),
    defineField({
      name: 'gallery',
      title: 'Gallery',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    }),
    defineField({ name: 'results', title: 'Results (PDF)', type: 'file' }),
    defineField({
      name: 'classes',
      title: 'Classes',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'showClass' }] }],
    }),
  ],
});

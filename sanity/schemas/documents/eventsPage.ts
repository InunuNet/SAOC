import { defineField, defineType } from 'sanity';

export const eventsPage = defineType({
  name: 'eventsPage',
  title: 'Events Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'intro', title: 'Intro', type: 'portableText' }),
  ],
});

import { defineField, defineType } from 'sanity';

export const aboutPage = defineType({
  name: 'aboutPage',
  title: 'About Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'pillars', title: 'Pillars', type: 'portableText' }),
    defineField({ name: 'timelineNodes', title: 'Timeline Nodes', type: 'portableText' }),
    defineField({ name: 'boardIntroText', title: 'Board Intro Text', type: 'text' }),
  ],
});

import { defineField, defineType } from 'sanity';

export const homePage = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'heroImages', title: 'Hero Images', type: 'array', of: [{ type: 'image' }] }),
    defineField({ name: 'missionText', title: 'Mission Text', type: 'text' }),
    defineField({ name: 'countdownDate', title: 'Countdown Target Date', type: 'datetime' }),
  ],
});

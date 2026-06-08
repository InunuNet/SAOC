import { defineField, defineType } from 'sanity';

export const nationalShow = defineType({
  name: 'nationalShow',
  title: 'National Show',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'showDate', title: 'Show Date', type: 'datetime' }),
    defineField({ name: 'location', title: 'Location', type: 'string' }),
    defineField({ name: 'hero', title: 'Hero Image', type: 'image' }),
    defineField({ name: 'countdownDate', title: 'Countdown Target Date', type: 'datetime' }),
    defineField({ name: 'exhibitorStages', title: 'Exhibitor Stages', type: 'portableText' }),
  ],
});

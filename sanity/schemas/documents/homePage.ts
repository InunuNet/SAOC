import { defineField, defineType } from 'sanity';

export const homePage = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'heroImages', title: 'Hero Images', type: 'array', of: [{ type: 'image' }] }),
    defineField({ name: 'missionText', title: 'Mission Text', type: 'text' }),
    // The show countdown is driven by `nationalShow.countdownDate`, which the home page
    // passes to ShowBand. A duplicate field here was editable but inert, so it was removed.
  ],
});

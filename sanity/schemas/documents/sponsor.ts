import { defineField, defineType } from 'sanity';

export const sponsor = defineType({
  name: 'sponsor',
  title: 'Sponsor',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({
      name: 'tier',
      title: 'Tier',
      type: 'string',
      options: {
        list: ['Title', 'Gold', 'Silver', 'Supporting'],
      },
    }),
    defineField({ name: 'logo', title: 'Logo', type: 'image' }),
    defineField({ name: 'website', title: 'Website', type: 'url' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'active', title: 'Active', type: 'boolean' }),
  ],
});

import { defineField, defineType } from 'sanity';

export const society = defineType({
  name: 'society',
  title: 'Society',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name' } }),
    defineField({ name: 'province', title: 'Province', type: 'string' }),
    defineField({ name: 'region', title: 'Region', type: 'string' }),
    defineField({ name: 'founded', title: 'Year Founded', type: 'number' }),
    defineField({ name: 'meets', title: 'Meeting Schedule', type: 'string' }),
    defineField({ name: 'venue', title: 'Venue', type: 'string' }),
    defineField({ name: 'memberCount', title: 'Member Count', type: 'number' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'logo', title: 'Logo', type: 'image' }),
    defineField({ name: 'website', title: 'Website', type: 'url' }),
    defineField({ name: 'markBadge', title: 'Mark Badge', type: 'boolean' }),
  ],
});

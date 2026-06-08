import { defineField, defineType } from 'sanity';

export const province = defineType({
  name: 'province',
  title: 'Province',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({ name: 'code', title: 'Code', type: 'string' }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name' },
    }),
  ],
});

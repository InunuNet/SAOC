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
    defineField({
      name: 'order',
      title: 'Chip Order',
      type: 'number',
      description:
        'Position in the /societies province filter. Lower sorts first. The sequence is ' +
        'curated (roughly south-west to north-east), not alphabetical.',
    }),
  ],
  orderings: [
    {
      title: 'Chip order',
      name: 'chipOrder',
      by: [
        { field: 'order', direction: 'asc' },
        { field: 'name', direction: 'asc' },
      ],
    },
  ],
});

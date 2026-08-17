import { defineField, defineType } from 'sanity';

export const vendorNursery = defineType({
  name: 'vendorNursery',
  title: 'Vendor Nursery',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'logo', title: 'Logo', type: 'image' }),
    defineField({ name: 'country', title: 'Country', type: 'string' }),
    defineField({ name: 'owner', title: 'Owner', type: 'string' }),
    defineField({ name: 'history', title: 'History', type: 'text' }),
    defineField({ name: 'specialisation', title: 'Specialisation', type: 'text' }),
    defineField({ name: 'plantsBrought', title: 'Plants Brought', type: 'text' }),
    defineField({ name: 'website', title: 'Website', type: 'url' }),
    defineField({
      name: 'socialMedia',
      title: 'Social Media',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'platform', title: 'Platform', type: 'string' }),
            defineField({ name: 'url', title: 'URL', type: 'url' }),
          ],
        },
      ],
    }),
    defineField({
      name: 'availableAtShow',
      title: 'Available at the Show',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          'Species orchids',
          'Hybrids',
          'Miniatures',
          'South American species',
          'Asian species',
          'Growing supplies',
        ],
      },
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'country' },
    prepare: ({ title, subtitle }) => ({ title: title ?? 'Untitled nursery', subtitle }),
  },
});

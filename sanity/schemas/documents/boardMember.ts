import { defineField, defineType } from 'sanity';

export const boardMember = defineType({
  name: 'boardMember',
  title: 'Board Member',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({ name: 'role', title: 'Role', type: 'string' }),
    defineField({ name: 'email', title: 'Email', type: 'string' }),
    defineField({ name: 'photo', title: 'Photo', type: 'image' }),
    defineField({ name: 'order', title: 'Display Order', type: 'number' }),
    defineField({
      name: 'placeholder',
      title: 'Placeholder (name not yet confirmed)',
      type: 'boolean',
      description:
        'True when this entry\'s name is a stand-in ("To be confirmed") rather than the ' +
        'real officeholder. Renders a visible "awaiting confirmation" marker on /about.',
      initialValue: false,
    }),
  ],
});

import { defineField, defineType } from 'sanity';

export const membersPage = defineType({
  name: 'membersPage',
  title: 'Members Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({ name: 'intro', title: 'Intro', type: 'portableText' }),
    defineField({
      name: 'resources',
      title: 'Resources',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string', title: 'Title' },
            { name: 'file', type: 'file', title: 'File' },
            { name: 'description', type: 'string', title: 'Description' },
            { name: 'membersOnly', type: 'boolean', title: 'Members Only' },
          ],
        },
      ],
    }),
  ],
});

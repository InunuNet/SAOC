import { defineField, defineType } from 'sanity';

export const contactPage = defineType({
  name: 'contactPage',
  title: 'Contact Page',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({
      name: 'directContacts',
      title: 'Direct Contacts',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'name', type: 'string', title: 'Name' },
            { name: 'role', type: 'string', title: 'Role' },
            { name: 'email', type: 'string', title: 'Email' },
          ],
        },
      ],
    }),
    defineField({
      name: 'formRecipients',
      title: 'Form Recipients',
      type: 'array',
      of: [{ type: 'string' }],
    }),
  ],
});

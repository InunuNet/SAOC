import { defineField, defineType } from 'sanity';

export const showClass = defineType({
  name: 'showClass',
  title: 'Show Class',
  type: 'document',
  fields: [
    defineField({ name: 'code', title: 'Code', type: 'string' }),
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'order', title: 'Display Order', type: 'number' }),
  ],
});

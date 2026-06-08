import { defineField, defineType } from 'sanity';

export const judge = defineType({
  name: 'judge',
  title: 'Judge',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({ name: 'region', title: 'Region', type: 'string' }),
    defineField({ name: 'accreditedSince', title: 'Accredited Since', type: 'number' }),
    defineField({ name: 'photo', title: 'Photo', type: 'image' }),
  ],
});

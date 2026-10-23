import { defineField, defineType } from 'sanity';

// societies-content F1: one committee role as the society's own form lists it. The role label
// and name are stored exactly as supplied in Lee-Ann's Drive doc.
export const societyCommitteeMember = defineType({
  name: 'societyCommitteeMember',
  title: 'Committee Member',
  type: 'object',
  fields: [
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'role' },
  },
});

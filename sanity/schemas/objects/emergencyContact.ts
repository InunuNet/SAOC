import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): national emergency numbers are stable public facts. Venue and
// show-specific numbers are committee-supplied and stay pending placeholders until they
// arrive — never invented, and never the venue switchboard dressed up as an emergency line.
export const emergencyContact = defineType({
  name: 'emergencyContact',
  title: 'Emergency Contact',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      title: 'Service',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'number',
      title: 'Number',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'note', title: 'Note', type: 'string' }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'number' },
  },
});

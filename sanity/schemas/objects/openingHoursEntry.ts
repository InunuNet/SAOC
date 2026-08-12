import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): free-text label and hours on purpose — the show's day structure
// is not confirmed, so a structured day-of-week enum would encode a decision nobody has made.
export const openingHoursEntry = defineType({
  name: 'openingHoursEntry',
  title: 'Opening Hours Entry',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      title: 'Day or Period',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description: "e.g. a named show day. Free text, because the show's day structure is not confirmed.",
    }),
    defineField({ name: 'hours', title: 'Hours', type: 'string' }),
    defineField({ name: 'note', title: 'Note', type: 'string' }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'hours' },
  },
});

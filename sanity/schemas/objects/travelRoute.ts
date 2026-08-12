import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): travel guidance is DATA, not prose in a component. Changing
// the venue means rewriting these array entries in Studio; the component maps over
// whatever is there and renders nothing when the array is empty.
export const travelRoute = defineType({
  name: 'travelRoute',
  title: 'Travel Route',
  type: 'object',
  fields: [
    defineField({
      name: 'origin',
      title: 'Arriving From',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'distance',
      title: 'Approximate Distance',
      type: 'string',
      description: "Free text so it can read 'about 22 km' rather than a false-precision number.",
    }),
    defineField({ name: 'duration', title: 'Approximate Travel Time', type: 'string' }),
    defineField({ name: 'directions', title: 'Directions', type: 'text' }),
    defineField({
      name: 'transportOptions',
      title: 'Transport Options',
      type: 'array',
      of: [{ type: 'string' }],
    }),
  ],
  preview: {
    select: { title: 'origin', subtitle: 'duration' },
  },
});

import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): grouped by distance from the venue, which is why distanceBand
// is an enum rather than free text. Deliberately carries NO price, star-rating or
// "show rate" field: SAOC has negotiated no rates with any property and must not appear
// to have done so. See contracts/golden/show-visitor-info/cticc-research.golden.md.
export const accommodationOption = defineType({
  name: 'accommodationOption',
  title: 'Accommodation Option',
  type: 'object',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'area', title: 'Area / Suburb', type: 'string' }),
    defineField({
      name: 'distanceBand',
      title: 'Distance From Venue',
      type: 'string',
      options: {
        list: [
          { title: 'Walking distance — under 1 km', value: 'walking' },
          { title: 'Nearby — 1 to 3 km', value: 'nearby' },
          { title: 'Wider city — 3 to 10 km', value: 'city' },
          { title: 'Further out — over 10 km', value: 'further' },
        ],
      },
      initialValue: 'nearby',
      validation: (Rule) => Rule.required(),
      description: 'walking = under 1 km · nearby = 1–3 km · city = 3–10 km · further = over 10 km',
    }),
    defineField({ name: 'note', title: 'Note', type: 'text' }),
    defineField({ name: 'url', title: 'Website', type: 'url' }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'area' },
  },
});

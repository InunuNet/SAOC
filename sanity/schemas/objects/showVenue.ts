import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): THE single source for every venue-derived value the site
// renders. Changing the venue is a Studio edit to this one object — no code change,
// no redeploy. A named object type (not an inline object) so a future exhibitor or
// programme document can reference the same shape without duplicating it.
// See contracts/golden/show-visitor-info/venue-single-source.golden.md.
export const showVenue = defineType({
  name: 'showVenue',
  title: 'Show Venue',
  type: 'object',
  fields: [
    defineField({
      name: 'name',
      title: 'Venue Name',
      type: 'string',
      description: "Full venue name as a visitor would read it, e.g. the convention centre's official name.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'addressLines',
      title: 'Street Address Lines',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'One entry per printed address line, in order. Do not include city or postal code here.',
    }),
    defineField({ name: 'city', title: 'City', type: 'string' }),
    defineField({ name: 'province', title: 'Province', type: 'string' }),
    defineField({ name: 'postalCode', title: 'Postal Code', type: 'string' }),
    defineField({
      name: 'latitude',
      title: 'Latitude',
      type: 'number',
      description: 'Decimal degrees. Used only to build a map link — no maps SDK is loaded.',
    }),
    defineField({
      name: 'longitude',
      title: 'Longitude',
      type: 'number',
      description: 'Decimal degrees.',
    }),
    defineField({
      name: 'mapsUrl',
      title: 'Map Link',
      type: 'url',
      description: 'Link-out to a map of the venue, opened in a new tab. Any provider. No API key is used.',
    }),
    defineField({
      name: 'mapImage',
      title: 'Static Map Image',
      type: 'image',
      description:
        'Optional. A static map screenshot or venue location graphic, uploaded here. Leave empty ' +
        'to show the map link on its own — never a broken embed.',
    }),
    defineField({
      name: 'mapImageAlt',
      title: 'Static Map Image Alt Text',
      type: 'string',
      description:
        'Describe the map for a screen-reader user, e.g. the venue position relative to a named ' +
        'landmark. Required whenever a static map image is set.',
    }),
    defineField({
      name: 'directionsNote',
      title: 'Directions Note',
      type: 'text',
      description:
        'Free-text arrival guidance — which entrance to use, where to be dropped off, landmarks ' +
        'to look for.',
    }),
    defineField({
      name: 'phone',
      title: 'Venue Switchboard',
      type: 'string',
      description:
        'General venue enquiries. NOT an emergency number — emergency contacts live on Show ' +
        'Visitor Information.',
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'city' },
  },
});

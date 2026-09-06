import { defineField, defineType } from 'sanity';

export const society = defineType({
  name: 'society',
  title: 'Society',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name' } }),
    defineField({ name: 'province', title: 'Province', type: 'string' }),
    defineField({ name: 'region', title: 'Region', type: 'string' }),
    defineField({ name: 'founded', title: 'Year Founded', type: 'number' }),
    defineField({ name: 'meets', title: 'Meeting Schedule', type: 'string' }),
    defineField({ name: 'venue', title: 'Venue', type: 'string' }),
    defineField({ name: 'memberCount', title: 'Member Count', type: 'number' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'logo', title: 'Logo', type: 'image' }),
    defineField({ name: 'website', title: 'Website', type: 'url' }),
    defineField({ name: 'markBadge', title: 'Mark Badge', type: 'boolean' }),
    defineField({
      name: 'foundedPlaceholder',
      title: 'Founding year is an estimate',
      type: 'boolean',
      description:
        'True when `founded` is our own estimate rather than a confirmed figure. Renders ' +
        'a visible "unconfirmed" marker on the society card and detail page.',
      initialValue: false,
    }),
    defineField({
      name: 'memberCountPlaceholder',
      title: 'Member count is an estimate',
      type: 'boolean',
      description:
        'True when `memberCount` is our own estimate rather than a confirmed figure. Renders ' +
        'a visible "unconfirmed" marker on the society card and detail page.',
      initialValue: false,
    }),
    defineField({
      name: 'meetPlaceholder',
      title: 'Meeting schedule not yet confirmed',
      type: 'boolean',
      description:
        'True when the society has not supplied a real meeting day/time. `meets` should be ' +
        'left empty rather than filled with an invented schedule — a wrong meeting time is ' +
        'actionable, not just inaccurate. Renders a visible "to be confirmed" marker instead ' +
        'of any specific value.',
      initialValue: false,
    }),
    defineField({
      name: 'venuePlaceholder',
      title: 'Venue not yet confirmed',
      type: 'boolean',
      description:
        'True when the society has not supplied a real venue. `venue` should be left empty ' +
        'rather than filled with an invented location — a wrong venue is actionable, not ' +
        'just inaccurate. Renders a visible "to be confirmed" marker instead of any specific ' +
        'value.',
      initialValue: false,
    }),
  ],
});

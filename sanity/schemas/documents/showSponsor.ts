import { defineField, defineType } from 'sanity';

// F14 (national-show-ia-alignment, M4) — the National Show's OWN sponsor list.
//
// See .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md
// § 6. Brad reinstated /national-show/sponsors and ruled explicitly: the Show's sponsors
// are a different list from SAOC's site-level /sponsors, and the two must be able to
// diverge. A `scope` field on the existing `sponsor` type was ruled out by name — it
// would let a rename or deactivate on the SAOC side silently mutate the show's list, and
// it edits a type the saoc-eb lane consumes. This is a new, independent document type.
export const showSponsor = defineType({
  name: 'showSponsor',
  title: 'Show Sponsor',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'tier',
      title: 'Tier',
      type: 'string',
      options: { list: ['Title', 'Gold', 'Silver', 'Supporting'] },
    }),
    defineField({ name: 'logo', title: 'Logo', type: 'image' }),
    defineField({ name: 'website', title: 'Website', type: 'url' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({
      name: 'active',
      title: 'Show on the site',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Sort position within its tier. Lower first.',
      initialValue: 0,
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'tier' },
    prepare: ({ title, subtitle }) => ({ title: title ?? 'Untitled sponsor', subtitle }),
  },
});

import { defineField, defineType } from 'sanity';

// F3 (conference-workshop-tickets, M2) — a presenter card for the SAOC Symposium or WOSA
// Conference. Carried forward unaffected by Brad's message 6 (which removed the
// early-bird/tranche mechanism from the conference ticketType products themselves, see
// ticketType.ts) — message 5 on presenter cards stands. See
// .agent/memory/project/specs/conference-workshop-tickets/goldens/f2-sanity-schema-migration.golden.md.
//
// `provenance` is NO initialValue — same discipline as
// sanity/schemas/objects/showPageSection.ts's own `provenance` field: a default-looking
// value here would silently mislabel content nobody has actually reviewed. Sanity's
// required-field validation then blocks publication until an editor makes an explicit,
// conscious choice.
export const conferencePresenter = defineType({
  name: 'conferencePresenter',
  title: 'Conference Presenter',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'role', title: 'Role', type: 'string' }),
    // Omitted until Lee-Ann supplies a real photo — no placeholder image invented here.
    defineField({ name: 'photo', title: 'Photo', type: 'image' }),
    defineField({ name: 'bio', title: 'Bio', type: 'text' }),
    defineField({
      name: 'event',
      title: 'Event',
      type: 'string',
      options: {
        list: [
          { title: 'SAOC Symposium', value: 'saoc-symposium' },
          { title: 'WOSA Conference', value: 'wosa-conference' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'order', title: 'Display Order', type: 'number' }),
    defineField({
      name: 'provenance',
      title: 'Provenance',
      type: 'string',
      options: {
        list: [
          { title: 'Council-supplied', value: 'council-supplied' },
          { title: 'Council draft — their words, not yet finished', value: 'council-draft' },
          { title: 'Research (verified, not council-confirmed)', value: 'research' },
          { title: 'Placeholder (AI-generated)', value: 'placeholder-ai' },
        ],
      },
      // NO initialValue — see the file header; this is the whole safety property.
      validation: (Rule) => Rule.required(),
      description:
        'Did the council write/confirm this presenter\'s details, or did we? Required — ' +
        'Sanity will not let this publish unset. Same convention as ' +
        'sanity/schemas/objects/showPageSection.ts\'s provenance field.',
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'event' },
  },
});

import { defineField, defineType } from 'sanity';

// F3 (conference-workshop-tickets, M2) — a single workshop session's structural shape.
// Carried forward unaffected by Brad's message 6. No real session (name, date, capacity) is
// council-confirmed yet, so this document type exists for a human to instantiate per session
// once the full schedule is supplied — this feature creates zero workshopSession documents
// (see A19). `timeSlot` is free text deliberately: no date/time is invented here. See
// .agent/memory/project/specs/conference-workshop-tickets/goldens/f2-sanity-schema-migration.golden.md.
//
// `provenance` is NO initialValue — same discipline as `conferencePresenter.ts` and
// sanity/schemas/objects/showPageSection.ts's own `provenance` field.
export const workshopSession = defineType({
  name: 'workshopSession',
  title: 'Workshop Session',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({
      name: 'presenter',
      title: 'Presenter',
      type: 'reference',
      to: [{ type: 'conferencePresenter' }],
    }),
    defineField({
      name: 'timeSlot',
      title: 'Time Slot',
      type: 'string',
      description: 'Free text (e.g. "Friday afternoon") — no invented date/time.',
    }),
    defineField({
      name: 'ticketType',
      title: 'Ticket Type',
      type: 'reference',
      to: [{ type: 'ticketType' }],
      description: 'Set only once a real, sellable session is confirmed.',
    }),
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
        'Did the council write/confirm this session\'s details, or did we? Required — ' +
        'Sanity will not let this publish unset. Same convention as ' +
        'sanity/schemas/objects/showPageSection.ts\'s provenance field.',
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'timeSlot' },
  },
});

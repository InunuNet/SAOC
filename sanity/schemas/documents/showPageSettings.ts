import { defineField, defineType } from 'sanity';

// F1 (national-show-ia-alignment, M1) — pinned singleton holding the wording for the
// placeholder-gate notices. Content, not code, so the council can reword it in Studio
// without a developer (spec 2.1). Follows the pendingLabel/researchLabel precedent at
// sanity/schemas/documents/showVisitorInfo.ts:26-46.
//
// All four fields are required. A missing singleton, or a blank field, must NOT be able
// to suppress a notice — lib/data/show-pages.ts falls back to a hardcoded constant that
// matches the seed defaults verbatim. See provenance-gate.golden.md.
export const showPageSettings = defineType({
  name: 'showPageSettings',
  title: 'Show Page Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'placeholderLabel',
      title: 'Placeholder Label',
      type: 'string',
      description: "Short badge text shown beside a section whose provenance is 'placeholder-ai'.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'placeholderNotice',
      title: 'Placeholder Notice',
      type: 'text',
      description: 'The full sentence shown above placeholder copy.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'researchLabel',
      title: 'Research Label',
      type: 'string',
      description: "Short badge text shown beside a section whose provenance is 'research'.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'researchNotice',
      title: 'Research Notice',
      type: 'text',
      description: 'The full sentence shown above researched-but-unconfirmed copy.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'draftLabel',
      title: 'Council Draft Label',
      type: 'string',
      description:
        "Short badge text shown beside a section whose provenance is 'council-draft' — the " +
        "council's own words, not yet finished.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'draftNotice',
      title: 'Council Draft Notice',
      type: 'text',
      description: 'The full sentence shown above an unfinished council draft.',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Show Page Settings' }),
  },
});

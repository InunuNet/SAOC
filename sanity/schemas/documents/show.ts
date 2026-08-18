import { defineField, defineType } from 'sanity';

import {
  findConflictingActiveShow,
  formatActiveShowConflictMessage,
  getPublishedId,
} from '../../../lib/active-show-guard';

export const show = defineType({
  name: 'show',
  title: 'Show',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string' }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
    }),
    defineField({ name: 'year', title: 'Year', type: 'number' }),
    defineField({ name: 'date', title: 'Date', type: 'datetime' }),
    defineField({ name: 'location', title: 'Location', type: 'string' }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: { list: ['past', 'upcoming', 'cancelled'] },
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({ name: 'entries', title: 'Entries', type: 'number' }),
    defineField({ name: 'exhibitors', title: 'Exhibitors', type: 'number' }),
    defineField({ name: 'awards', title: 'Awards', type: 'number' }),
    defineField({ name: 'summary', title: 'Summary', type: 'portableText' }),
    defineField({
      name: 'gallery',
      title: 'Gallery',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    }),
    defineField({ name: 'results', title: 'Results (PDF)', type: 'file' }),
    defineField({
      name: 'classes',
      title: 'Classes',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'showClass' }] }],
    }),
    // F1 (ticketing-foundation): sales-facing fields, all optional/defaulted so no
    // published archive document (6 existing) is invalidated. See
    // contracts/golden/ticketing-f1-show-collision/README.md — "Field additions".
    defineField({ name: 'edition', title: 'Edition', type: 'number' }),
    defineField({ name: 'startDate', title: 'Start Date', type: 'datetime' }),
    defineField({ name: 'endDate', title: 'End Date', type: 'datetime' }),
    defineField({ name: 'venue', title: 'Venue', type: 'showVenue' }),
    defineField({
      name: 'salesOpen',
      title: 'Sales Open',
      type: 'boolean',
      initialValue: false,
      description:
        'Not yet wired into checkout as of F1 — nationalShowSalesQuery still gates ' +
        'purchases off the nationalShow singleton. See README for the deferred migration.',
    }),
    defineField({
      name: 'active',
      title: 'Active (sellable) show',
      type: 'boolean',
      initialValue: false,
      description:
        'Exactly one show should be active at a time. Consumed by resolveActiveShow() ' +
        '(lib/show-resolution.ts), which fails closed to "no active show" if zero or ' +
        'more than one show is marked active.',
      // F3 (production-blockers): Studio-side guard against a second show becoming
      // active. Queries other `show` documents at publish time and blocks the edit
      // with an editor-facing message if one is already active. See
      // contracts/golden/production-blockers-f3-studio-active-show-guard/README.md.
      validation: (Rule) =>
        Rule.custom(async (activeValue, context) => {
          if (activeValue !== true) return true;
          const documentId = context.document?._id;
          if (!documentId) return true;
          const client = context.getClient({ apiVersion: '2024-01-01' });
          const publishedId = getPublishedId(documentId as string);
          const others = await client.fetch(
            `*[_type == "show" && active == true && !(_id in [$id, $draftId])]{ _id, title, year }`,
            { id: publishedId, draftId: `drafts.${publishedId}` }
          );
          const conflict = findConflictingActiveShow(others);
          return conflict ? formatActiveShowConflictMessage(conflict) : true;
        }),
    }),
    // fictional-test-show: additive marker field. Optional/defaulted so every pre-existing
    // published show document (including show-19-2027) remains valid without a migration.
    defineField({
      name: 'fictionalTestData',
      title: 'Fictional Test Data (never a real show)',
      type: 'boolean',
      initialValue: false,
      description:
        'Marks this show document as fictional test data used to exercise the ticketing ' +
        'pipeline end-to-end in isolation from the real show. Never set active:true except ' +
        'for a brief, human-supervised test window — see ' +
        'contracts/golden/fictional-test-show/README.md.',
    }),
  ],
});

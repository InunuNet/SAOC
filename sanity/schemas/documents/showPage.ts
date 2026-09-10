import { defineField, defineType } from 'sanity';

// F1 (national-show-ia-alignment, M1) — ONE showPage document type serving all 17
// National Show pages (spec entries 1-13, 15-18; entry 14 is a link, not a page — see
// route-map.golden.md), rather than a per-page singleton. See content-model.golden.md
// for why: a 19th page must not be a developer ticket, and the provenance gate must
// live in one schema, not eighteen.
//
// `pageKey` carries the spec's own two-digit section number as a prefix purely so the
// Studio list sorts into sitemap order with no separate ordering field — e.g.
// "04-south-african-exhibitors". Spec entry 1 is keyed "01-national-show-landing", not
// "01-home": the National Show is a SUBSECTION of saoc.co.za, which is this site's only
// home page (.agent/memory/project/rules.md). The word "home" must never appear in this
// model — see page-contract.golden.md and assertion P7.
export const showPage = defineType({
  name: 'showPage',
  title: 'Show Page',
  type: 'document',
  fields: [
    defineField({
      name: 'pageKey',
      title: 'Page Key',
      type: 'string',
      description:
        'Immutable after seeding. Format: two-digit spec section number, a hyphen, then a ' +
        'lowercase-kebab slug — e.g. "04-south-african-exhibitors".',
      validation: (Rule) =>
        Rule.required()
          .regex(/^[0-9]{2}-[a-z0-9-]+$/, {
            name: 'pageKey format',
            invert: false,
          })
          .custom(async (value, context) => {
            if (!value) return true;
            const { document, getClient } = context;
            if (!document || !getClient) return true;
            const client = getClient({ apiVersion: '2024-01-01' });
            const id = (document._id ?? '').replace(/^drafts\./, '');
            const params = { draft: `drafts.${id}`, published: id, pageKey: value };
            const duplicateId = await client.fetch<string | null>(
              `*[_type == "showPage" && pageKey == $pageKey && !(_id in [$draft, $published])][0]._id`,
              params,
            );
            return duplicateId ? 'Another showPage document already uses this pageKey.' : true;
          }),
    }),
    defineField({
      name: 'specNumber',
      title: 'Spec Section Number',
      type: 'number',
      description:
        'The join back to spec Section 4. Integer 1-18, excluding 14 (14 is a link, never ' +
        'a document).',
      validation: (Rule) =>
        Rule.required()
          .integer()
          .min(1)
          .max(18)
          .custom((value) => {
            if (value === 14) {
              return (
                'Spec entry 14 (Orchid Societies) is a link to /societies, never a showPage ' +
                'document — see route-map.golden.md. This field\'s own description says so; ' +
                'the range alone did not enforce it.'
              );
            }
            return true;
          }),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: "The page's own H1 text, editable by the council.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      description:
        'One or two sentences, used for cards and meta description. NOT a section — it ' +
        'has no independent provenance and must never carry a factual claim.',
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      of: [{ type: 'showPageSection' }],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({ name: 'seoTitle', title: 'SEO Title', type: 'string' }),
    defineField({ name: 'seoDescription', title: 'SEO Description', type: 'text' }),
    defineField({ name: 'seoImage', title: 'SEO Image', type: 'image' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'pageKey' },
  },
});

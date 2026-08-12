import { defineField, defineType } from 'sanity';

// F1 (show-exhibitor-info): one reference section of the exhibitor guide — a heading
// plus a portable-text body.
//
// Deliberately carries NO status field. Status for the fixed singleton blocks lives
// centrally on showExhibitorInfo.confirmations, keyed by the same field name. Two
// sources of status would drift, and a drifted status is worse than none: it would let
// researched convention read as committee-confirmed SAOC policy.
// See contracts/golden/show-exhibitor-info/showExhibitorInfo-schema.golden.json.
export const exhibitorSection = defineType({
  name: 'exhibitorSection',
  title: 'Exhibitor Section',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
      description:
        'Never phrase this as settled SAOC policy unless the show committee has confirmed it. ' +
        'Write "Most orchid shows require…" or "SAOC\'s committee has not yet set…", never a ' +
        'bare "Entries close…". An exhibitor turned away at staging because this page invented ' +
        'a rule has been harmed by us.',
    }),
  ],
  preview: {
    select: { title: 'heading' },
  },
});

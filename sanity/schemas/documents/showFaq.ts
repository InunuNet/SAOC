import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): the FAQ collection driving /national-show/faq.
//
// A collection rather than an array on showVisitorInfo, because the committee will add
// and confirm questions one at a time and each needs its own confirmation status.
// See contracts/golden/show-visitor-info/showFaq-schema.golden.json.
export const showFaq = defineType({
  name: 'showFaq',
  title: 'Show FAQ',
  type: 'document',
  fields: [
    defineField({
      name: 'question',
      title: 'Question',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'portableText',
      description:
        'Reuses the existing Portable Text object type — the same one nationalShow.exhibitorStages ' +
        'uses, so it renders with the PortableText component already on the show pages.',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      validation: (Rule) => Rule.required(),
      options: {
        list: [
          { title: 'Getting There', value: 'getting-there' },
          { title: 'Tickets', value: 'tickets' },
          { title: 'Accessibility', value: 'accessibility' },
          { title: 'Plant Sales', value: 'plant-sales' },
          { title: 'General', value: 'general' },
        ],
      },
      initialValue: 'general',
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Sort position within the category. Lower first.',
      initialValue: 0,
    }),
    defineField({
      name: 'status',
      title: 'Confirmation Status',
      type: 'string',
      options: {
        list: [
          { title: 'Pending — placeholder answer, committee must supply', value: 'pending' },
          { title: 'Research — our own verified research, not committee-confirmed', value: 'research' },
          { title: 'Confirmed — signed off by the show committee', value: 'confirmed' },
        ],
      },
      initialValue: 'pending',
    }),
    defineField({
      name: 'active',
      title: 'Show on the site',
      type: 'boolean',
      initialValue: true,
      description: 'Uncheck to hide a question without deleting it. Same pattern as Ticket Types.',
    }),
  ],
  preview: {
    select: { title: 'question', subtitle: 'category' },
  },
});

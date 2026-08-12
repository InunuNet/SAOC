import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): one status per visitor-facing content block, driving the
// visible "to be confirmed by the show committee" marker on the page.
//
// Built by mapping over BLOCKS rather than writing thirteen near-identical defineField
// calls: same options list, same initialValue, one place to change.
//
// Every block defaults to 'pending'. That default is the whole safety property — an
// unset status can never read as committee-confirmed fact.
// See contracts/golden/show-visitor-info/confirmation-status-model.golden.md.

const STATUS_OPTIONS = [
  { title: 'Pending — placeholder, committee must supply', value: 'pending' },
  { title: 'Research — our own verified research, not committee-confirmed', value: 'research' },
  { title: 'Confirmed — signed off by the show committee', value: 'confirmed' },
];

const BLOCKS: ReadonlyArray<{ name: string; title: string }> = [
  { name: 'venue', title: 'Venue' },
  { name: 'dates', title: 'Show Dates' },
  { name: 'openingHours', title: 'Opening Hours' },
  { name: 'admission', title: 'Admission' },
  { name: 'parking', title: 'Parking' },
  { name: 'publicTransport', title: 'Public Transport' },
  { name: 'accessibility', title: 'Accessibility' },
  { name: 'photography', title: 'Photography Policy' },
  { name: 'cloakroom', title: 'Cloakroom and Plant Holding' },
  { name: 'food', title: 'Food and Refreshments' },
  { name: 'accommodation', title: 'Accommodation' },
  { name: 'attractions', title: 'Nearby Attractions' },
  { name: 'emergencyContacts', title: 'Emergency Contacts' },
];

export const confirmationStatuses = defineType({
  name: 'confirmationStatuses',
  title: 'Confirmation Statuses',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: BLOCKS.map(({ name, title }) =>
    defineField({
      name,
      title,
      type: 'string',
      options: { list: STATUS_OPTIONS },
      initialValue: 'pending',
    }),
  ),
});

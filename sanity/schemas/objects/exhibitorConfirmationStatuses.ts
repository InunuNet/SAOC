import { defineField, defineType } from 'sanity';

// F1 (show-exhibitor-info): one confirmation status per fixed content block on the
// exhibitor guide, driving the visible marker the page renders beside that block.
//
// FOUR VALUES, NOT THE VISITOR STREAM'S THREE. The exhibitor research has a category the
// visitor research did not — section 12, "things this research could NOT establish"
// (overnight security, watering during the run, insurance, who may build a display,
// domestic plant-movement permits). Filing those as `pending` would imply a value exists
// and simply has not been typed in; filing them as `research` would present a gap as a
// finding. `question` says what is true: we looked, and the public record is empty.
//
// Deliberately a separate type from objects/confirmationStatuses.ts rather than an
// extension of it: that object's thirteen block names are visitor-specific. Unifying the
// two is booked as FU-3 in exhibitorStages-reconciliation.golden.md.
//
// Every block defaults to 'pending'. That default is the whole safety property — an
// unset status can never read as committee-confirmed fact. Fail closed.
// See contracts/golden/show-exhibitor-info/exhibitor-confirmation-model.golden.md.

const STATUS_OPTIONS = [
  { title: 'Pending — placeholder, the show committee must supply this', value: 'pending' },
  { title: 'Research — verified international show practice, not SAOC policy', value: 'research' },
  { title: 'Question — the research could not establish this', value: 'question' },
  { title: 'Confirmed — signed off by the show committee', value: 'confirmed' },
];

// Must stay in step with the exhibitorSection fields on showExhibitorInfo, plus the
// entry-form block. The contract asserts the two sets agree, so a section can never be
// added without a status and a status can never dangle without a section.
const BLOCKS: ReadonlyArray<{ name: string; title: string }> = [
  { name: 'entryProcess', title: 'How Entry Works' },
  { name: 'fees', title: 'Entry Fees' },
  { name: 'classes', title: 'Classes' },
  { name: 'judging', title: 'Judging' },
  { name: 'eligibility', title: 'Plant Condition and Eligibility' },
  { name: 'display', title: 'Displays and Stands' },
  { name: 'sales', title: 'Selling Plants' },
  { name: 'practicalities', title: 'Insurance, Security, Watering and Loading' },
  { name: 'permits', title: 'Permits and Moving Plants Between Provinces' },
  { name: 'entryForm', title: 'Entry Form' },
];

export const exhibitorConfirmationStatuses = defineType({
  name: 'exhibitorConfirmationStatuses',
  title: 'Exhibitor Confirmation Statuses',
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

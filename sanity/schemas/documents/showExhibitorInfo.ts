import { defineField, defineType } from 'sanity';

// F1 (show-exhibitor-info): the page singleton behind /national-show/exhibitors.
//
// Research section 9 found a near-universal pattern: every established orchid show
// separates exhibitor information into distinct documents — registration instructions,
// the class schedule, rules and eligibility, awards — rather than one blob. Research
// section 10 found SAOC's current state is the opposite: a single unstructured
// nationalShow.exhibitorStages field. This schema is that separation, expressed as one
// typed field per topic.
//
// WHAT IT DELIBERATELY DOES NOT CONTAIN:
//   - No calendar-typed exhibitor deadline. See objects/showExhibitorDate.ts.
//   - No class list. Show classes already render on /national-show from `showClass`.
//   - No judging criteria. SAOC judging standards already live on /judging.
//   - No online entry submission. The entry form is a committee-supplied PDF; an online
//     submission needs a data-handling decision the council has not been asked for.
//
// Pinned singleton, _id === type name, per sanity/structure.ts convention.
// See contracts/golden/show-exhibitor-info/showExhibitorInfo-schema.golden.json.
export const showExhibitorInfo = defineType({
  name: 'showExhibitorInfo',
  title: 'Show Exhibitor Information',
  type: 'document',
  groups: [
    { name: 'intro', title: 'Introduction' },
    { name: 'labels', title: 'Status Labels' },
    { name: 'dates', title: 'Key Dates' },
    { name: 'entryForm', title: 'Entry Form' },
    { name: 'sections', title: 'Reference Sections' },
    { name: 'questions', title: 'Open Questions' },
    { name: 'status', title: 'Confirmation Status' },
  ],
  fields: [
    defineField({ group: 'intro', name: 'title', title: 'Page Title', type: 'string' }),
    defineField({ group: 'intro', name: 'intro', title: 'Introduction', type: 'text', rows: 4 }),

    // --- status labels: the wording of every marker, editable in one place ---
    // All three are REQUIRED. They carry the page's entire "not yet SAOC policy" posture, and
    // clearing one used to be silent: no warning in Studio, and 23 empty boxes on the page.
    // The component also holds a last-resort constant, so validation is the warning and the
    // constant is the floor. See components/show/ExhibitorStatusBadge.tsx.
    defineField({
      group: 'labels',
      name: 'pendingLabel',
      title: 'Pending Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description:
        'Shown on any block the show committee still has to supply — and on any block whose ' +
        'status is missing or unrecognised. Reword here and it changes everywhere.',
    }),
    defineField({
      group: 'labels',
      name: 'researchLabel',
      title: 'Research Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description:
        'Shown on blocks that carry established international show practice we verified ' +
        'ourselves. A starting point for the committee to correct, never SAOC policy.',
    }),
    defineField({
      group: 'labels',
      name: 'questionLabel',
      title: 'Question Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description: 'Shown on blocks where the research looked and found nothing published.',
    }),

    // --- key dates ---
    defineField({ group: 'dates', name: 'keyDatesHeading', title: 'Key Dates — Heading', type: 'string' }),
    defineField({
      group: 'dates',
      name: 'keyDatesNote',
      title: 'Key Dates — Note',
      type: 'text',
      rows: 3,
      description:
        'Renders ABOVE the table, not below it, so the unset state is unmissable before anyone ' +
        'reads a row.',
    }),
    defineField({
      group: 'dates',
      name: 'keyDatesCaption',
      title: 'Key Dates — Table Caption',
      type: 'string',
      description:
        "The table's accessible name, announced before the rows. Name the table and nothing " +
        'more — do not state whether the dates are set. The per-row markers already say that, ' +
        'correctly and per row, and a caption saying it too goes stale the moment you set one.',
    }),
    defineField({
      group: 'dates',
      name: 'keyDates',
      title: 'Key Dates',
      type: 'array',
      of: [{ type: 'showExhibitorDate' }],
      description: 'Entries close, staging, judging, show days, removal.',
    }),

    // --- entry form: a committee-supplied PDF, NOT an online submission form ---
    defineField({ group: 'entryForm', name: 'entryFormHeading', title: 'Entry Form — Heading', type: 'string' }),
    defineField({
      group: 'entryForm',
      name: 'entryFormFile',
      title: 'Entry Form — File',
      type: 'file',
      options: { accept: '.pdf' },
      description:
        "Upload the show committee's entry form PDF. Until one exists, leave this empty — the " +
        'page renders an honest "to be published" state rather than a link that goes nowhere.',
    }),
    defineField({
      group: 'entryForm',
      name: 'entryFormUrl',
      title: 'Entry Form — External URL',
      type: 'url',
      description: 'Only if the form is hosted elsewhere. Leave empty if you uploaded a file above.',
    }),
    defineField({
      group: 'entryForm',
      name: 'entryFormPendingNote',
      title: 'Entry Form — Pending Note',
      type: 'text',
      rows: 3,
      description:
        'Shown when neither a file nor a URL is set. This is the honest empty state; the page ' +
        'renders it as plain text and never wraps it in a link.',
    }),

    // --- reference sections, one per research section ---
    defineField({ group: 'sections', name: 'entryProcess', title: 'How Entry Works', type: 'exhibitorSection' }),
    defineField({ group: 'sections', name: 'fees', title: 'Entry Fees', type: 'exhibitorSection' }),
    defineField({
      group: 'sections',
      name: 'classes',
      title: 'Classes',
      type: 'exhibitorSection',
      description:
        'Describes how classes work in general and points at the class list on the show overview ' +
        'page. Never restate a class or a class code here — the showClass documents are the ' +
        'single source and a second copy drifts.',
    }),
    defineField({
      group: 'sections',
      name: 'judging',
      title: 'Judging',
      type: 'exhibitorSection',
      description:
        'General judging convention plus a link to the judging pages. Never restate a judging ' +
        'criterion or a points scale here.',
    }),
    defineField({
      group: 'sections',
      name: 'eligibility',
      title: 'Plant Condition and Eligibility',
      type: 'exhibitorSection',
    }),
    defineField({ group: 'sections', name: 'display', title: 'Displays and Stands', type: 'exhibitorSection' }),
    defineField({ group: 'sections', name: 'sales', title: 'Selling Plants', type: 'exhibitorSection' }),
    defineField({
      group: 'sections',
      name: 'practicalities',
      title: 'Insurance, Security, Watering and Loading',
      type: 'exhibitorSection',
    }),
    defineField({
      group: 'sections',
      name: 'permits',
      title: 'Permits and Moving Plants Between Provinces',
      type: 'exhibitorSection',
      description:
        'This block asks; it does not tell. It states the verified negative — that international ' +
        'trade rules do not follow from moving cultivated plants between provinces — and leaves ' +
        'every domestic requirement as an open question.',
    }),

    // --- open questions: research section 12 as structured data rather than prose ---
    defineField({ group: 'questions', name: 'questionsHeading', title: 'Questions — Heading', type: 'string' }),
    defineField({ group: 'questions', name: 'questionsIntro', title: 'Questions — Intro', type: 'text', rows: 4 }),
    defineField({
      group: 'questions',
      name: 'openQuestions',
      title: 'Open Questions',
      type: 'array',
      of: [{ type: 'exhibitorQuestion' }],
      description:
        'Things the research could not establish. These render on the page so an exhibitor knows ' +
        'what is genuinely undecided, and so the committee can see its own to-do list.',
    }),

    defineField({
      group: 'status',
      name: 'confirmations',
      title: 'Confirmation Statuses',
      type: 'exhibitorConfirmationStatuses',
    }),

    // --- cross-links: the two things this page must link to and never duplicate ---
    defineField({ group: 'sections', name: 'judgingLinkLabel', title: 'Judging Link Label', type: 'string' }),
    defineField({ group: 'sections', name: 'classesLinkLabel', title: 'Classes Link Label', type: 'string' }),
    defineField({ group: 'sections', name: 'contactNote', title: 'Contact Note', type: 'text', rows: 3 }),
  ],
  preview: {
    select: { title: 'title' },
    prepare: ({ title }) => ({ title: title ?? 'Show Exhibitor Information' }),
  },
});

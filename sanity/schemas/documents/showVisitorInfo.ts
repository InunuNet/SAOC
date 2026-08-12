import { defineField, defineType } from 'sanity';

// F1 (show-visitor-info): page singleton holding every piece of visitor-facing copy
// across /national-show/plan-your-visit, /national-show/what-to-expect and
// /national-show/faq.
//
// Venue identity deliberately does NOT live here — it lives on nationalShow.venue.
// This document is "what a visitor needs to plan"; nationalShow is "what the show is".
// Splitting them the other way would either fragment show identity across two documents
// or produce one thirty-field nationalShow.
//
// Pinned singleton, _id === type name, per sanity/structure.ts convention.
// See contracts/golden/show-visitor-info/showVisitorInfo-schema.golden.json.
export const showVisitorInfo = defineType({
  name: 'showVisitorInfo',
  title: 'Show Visitor Information',
  type: 'document',
  groups: [
    { name: 'labels', title: 'Pending Labels' },
    { name: 'plan', title: 'Plan Your Visit' },
    { name: 'expect', title: 'What to Expect' },
    { name: 'faq', title: 'FAQ Page' },
    { name: 'status', title: 'Confirmation Status' },
  ],
  fields: [
    defineField({
      group: 'labels',
      name: 'pendingLabel',
      title: 'Pending Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description:
        'Shown beside any block whose confirmation status is Pending. Reword here and it ' +
        'changes everywhere.',
    }),
    defineField({
      group: 'labels',
      name: 'researchLabel',
      title: 'Research Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
      description:
        'Shown beside any block whose confirmation status is Research — verified by the web ' +
        'team against the working venue, but not confirmed by the committee.',
    }),

    defineField({ group: 'plan', name: 'planTitle', title: 'Plan Your Visit — Page Title', type: 'string' }),
    defineField({ group: 'plan', name: 'planIntro', title: 'Plan Your Visit — Intro', type: 'text' }),
    defineField({ group: 'plan', name: 'gettingThereIntro', title: 'Getting There — Intro', type: 'text' }),
    defineField({
      group: 'plan',
      name: 'airportRoutes',
      title: 'Travel From Airports',
      type: 'array',
      of: [{ type: 'travelRoute' }],
      description: 'One entry per national airport a visitor might arrive at. Renders nothing if empty.',
    }),
    defineField({ group: 'plan', name: 'parking', title: 'Parking', type: 'text' }),
    defineField({ group: 'plan', name: 'publicTransport', title: 'Public Transport', type: 'text' }),
    defineField({ group: 'plan', name: 'accommodationIntro', title: 'Accommodation — Intro', type: 'text' }),
    defineField({
      group: 'plan',
      name: 'accommodation',
      title: 'Accommodation',
      type: 'array',
      of: [{ type: 'accommodationOption' }],
      description: 'Grouped on the page by distance band. Order within a band follows this array.',
    }),
    defineField({
      group: 'plan',
      name: 'attractions',
      title: 'Nearby Attractions',
      type: 'array',
      of: [{ type: 'attraction' }],
    }),
    defineField({
      group: 'plan',
      name: 'emergencyContacts',
      title: 'Emergency Contacts',
      type: 'array',
      of: [{ type: 'emergencyContact' }],
    }),

    defineField({ group: 'expect', name: 'expectTitle', title: 'What to Expect — Page Title', type: 'string' }),
    defineField({ group: 'expect', name: 'expectIntro', title: 'What to Expect — Intro', type: 'text' }),
    defineField({
      group: 'expect',
      name: 'openingHours',
      title: 'Opening Hours',
      type: 'array',
      of: [{ type: 'openingHoursEntry' }],
    }),
    defineField({
      group: 'expect',
      name: 'admissionNote',
      title: 'Admission Note',
      type: 'text',
      description:
        'Explains how admission works — concessions, door vs advance, re-entry. DO NOT put ' +
        'prices here. Prices live on Ticket Types and are shown on the ticket page; this page ' +
        'links there.',
    }),
    defineField({
      group: 'expect',
      name: 'admissionLinkLabel',
      title: 'Admission Link Label',
      type: 'string',
      description: "Label for the link through to the ticket page, e.g. 'See ticket prices and book'.",
    }),
    defineField({ group: 'expect', name: 'food', title: 'Food and Refreshments', type: 'text' }),
    defineField({ group: 'expect', name: 'photographyPolicy', title: 'Photography Policy', type: 'text' }),
    defineField({ group: 'expect', name: 'cloakroom', title: 'Cloakroom and Plant Holding', type: 'text' }),
    defineField({
      group: 'expect',
      name: 'accessibility',
      title: 'Wheelchair Access and Accessibility',
      type: 'text',
    }),

    defineField({ group: 'faq', name: 'faqTitle', title: 'FAQ — Page Title', type: 'string' }),
    defineField({ group: 'faq', name: 'faqIntro', title: 'FAQ — Intro', type: 'text' }),
    defineField({
      group: 'faq',
      name: 'faqContactNote',
      title: 'FAQ — Contact Prompt',
      type: 'text',
      description: 'Shown under the questions, above the link to the contact page.',
    }),

    defineField({
      group: 'status',
      name: 'confirmations',
      title: 'Confirmation Status',
      type: 'confirmationStatuses',
      description:
        'Controls the pending / research marker beside each block. Set a block to Confirmed ' +
        'only once the show committee has signed that detail off.',
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Show Visitor Information' }),
  },
});

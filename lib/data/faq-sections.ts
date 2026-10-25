export interface FaqSection {
  id: string;
  title: string;
  /** Her introduction paragraphs, verbatim; empty when she gave none. */
  intro: string[];
}

/**
 * The FAQ's twelve sections: ids, order, titles and introductions as Lee-Ann wrote them in her 24 Oct 2026
 * FAQ document. The one source for ShowFaqList, the FAQ page and the showFaq.category list.
 */
export const FAQ_SECTIONS: readonly FaqSection[] = [
  {
    id: 'general-show-information',
    title: 'General Show information',
    intro: [
      'For members of the public, orchid enthusiasts and visitors.',
    ],
  },
  {
    id: 'tickets-and-entry',
    title: 'Tickets and entry',
    intro: [
      'Thicket types and prices are on the website. There are early bird tickets, symposium and conference tickets as well as full weekend passes and daily entry tickets.',
    ],
  },
  {
    id: 'getting-to-the-venue-and-accessibility',
    title: 'Getting to the venue and accessibility',
    intro: [],
  },
  {
    id: 'orchid-displays-judging-and-awards',
    title: 'Orchid displays, judging and awards',
    intro: [],
  },
  {
    id: 'orchid-sales-and-vendors',
    title: 'Orchid sales and vendors',
    intro: [],
  },
  {
    id: 'symposium',
    title: 'Symposium',
    intro: [
      'For visitors interested in orchid science, cultivation, conservation and horticulture. Bookings can be made on the website.',
    ],
  },
  {
    id: 'wosa-conference',
    title: 'WOSA Conference',
    intro: [
      'For Wild Orchids Southern Africa members, conservation enthusiasts and conference delegates.',
    ],
  },
  {
    id: 'workshops-and-other-activities',
    title: 'Workshops and other activities',
    intro: [],
  },
  {
    id: 'food-refreshments-and-facilities',
    title: 'Food, refreshments and facilities',
    intro: [],
  },
  {
    id: 'accommodation-travel-and-tourism',
    title: 'Accommodation, travel and tourism',
    intro: [
      'Please see the Plan your visit tab on the website for more information.',
    ],
  },
  {
    id: 'exhibitors-vendors-and-sponsors',
    title: 'Exhibitors, vendors and sponsors',
    intro: [],
  },
  {
    id: 'policies-and-visitor-information',
    title: 'Policies and visitor information',
    intro: [],
  },
];

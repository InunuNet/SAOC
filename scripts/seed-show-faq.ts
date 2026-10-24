/**
 * Seeds the National Orchid Show FAQ from Lee-Ann's 24 Oct 2026 FAQ document (mission
 * leeann-content-build, F3): 79 showFaq documents in her 12 sections, and removes the 14 legacy
 * documents they replace.
 *
 * DRY RUN BY DEFAULT. With no flag the script touches nothing, needs no token, and prints one JSON
 * object { mode: 'dry-run', documents, delete }. Only --apply writes.
 *
 * --apply:
 *   1. reads NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET and SANITY_API_TOKEN (write
 *      enabled) from the environment or .env.local,
 *   2. backs up every existing showFaq document to .tmp/sandbox/faq-backup/ and stops if that fails,
 *   3. re-reads the revisions just before committing and stops if any showFaq document changed
 *      since the backup,
 *   4. commits one transaction: createOrReplace on showFaq-q<N> for each question, then delete of
 *      the legacy ids.
 *
 * Run with: pnpm exec tsx scripts/seed-show-faq.ts [--apply]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

const API_VERSION = '2024-01-01';
const BACKUP_DIR = '.tmp/sandbox/faq-backup';
const APPLY_FLAG = '--apply';

interface FaqSeed {
  number: number;
  section: string;
  question: string;
  answer: string[];
}

interface PortableBlock {
  _type: 'block';
  _key: string;
  style: 'normal';
  markDefs: never[];
  children: Array<{ _type: 'span'; _key: string; text: string; marks: never[] }>;
}

interface FaqDocument {
  _id: string;
  _type: 'showFaq';
  question: string;
  category: string;
  order: number;
  status: 'confirmed';
  active: true;
  answer: PortableBlock[];
}


const LEGACY_IDS: readonly string[] = [
  'showFaq-accessibility-1',
  'showFaq-accessibility-2',
  'showFaq-general-1',
  'showFaq-general-2',
  'showFaq-general-3',
  'showFaq-getting-there-1',
  'showFaq-getting-there-2',
  'showFaq-getting-there-3',
  'showFaq-plant-sales-1',
  'showFaq-plant-sales-2',
  'showFaq-plant-sales-3',
  'showFaq-tickets-1',
  'showFaq-tickets-2',
  'showFaq-tickets-3',
];

const QUESTIONS: readonly FaqSeed[] = [
  {
    number: 1,
    section: 'general-show-information',
    question: 'What is the National Orchid Show – Western Cape 2027?',
    answer: [
      'The National Orchid Show is a major celebration of orchids, bringing together orchid societies, growers, exhibitors, vendors and enthusiasts. Visitors can enjoy orchid displays, see outstanding plants, purchase orchids and related products, and participate in selected educational activities.',
    ],
  },
  {
    number: 2,
    section: 'general-show-information',
    question: 'When and where will the Show take place?',
    answer: [
      'The Show will take place in September 2027 at Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, Stellenbosch, Western Cape.',
      'Plant delivery for judging will take place from Tuesday to Wednesday. The show will open to the public on the 23rd September 2027.',
    ],
  },
  {
    number: 3,
    section: 'general-show-information',
    question: 'What is the theme of the Show?',
    answer: [
      'The theme is “From Wild Origins to Cultivated Excellence: The Future of Orchids”.',
    ],
  },
  {
    number: 4,
    section: 'general-show-information',
    question: 'Who is organising the Show?',
    answer: [
      'The Show is being hosted by five orchid organisations: Walker Bay Orchid Society, Cape Orchid Society, Tygerberg Orchid Group, Southern Cape Orchid Society and Wild Orchids Southern Africa (WOSA), in conjunction with the South African Orchid Council (SAOC).',
    ],
  },
  {
    number: 5,
    section: 'general-show-information',
    question: 'What can visitors expect to see and do?',
    answer: [
      'Visitors can explore orchid displays, view plants presented for judging and awards, buy orchids from participating vendors, and learn more about orchid growing, conservation and cultivation. Additional activities will include a symposium, workshops and the WOSA Conference.',
    ],
  },
  {
    number: 6,
    section: 'general-show-information',
    question: 'Is the Show suitable for beginners?',
    answer: [
      'Yes. The Show is intended for both experienced orchid growers and people who are new to orchids. It offers an opportunity to discover different orchid species and hybrids, meet knowledgeable growers and learn about orchid care.',
    ],
  },
  {
    number: 7,
    section: 'general-show-information',
    question: 'Do I need to be a member of an orchid society to attend?',
    answer: [
      'No. The Show is open to the public. You do not need to belong to an orchid society to visit.',
    ],
  },
  {
    number: 8,
    section: 'general-show-information',
    question: 'Will there be international exhibitors and vendors?',
    answer: [
      'International guests and exhibitors, including international orchid vendors, are planned as part of the event. The final list of participants and the availability of particular plants will be confirmed closer to the Show.',
    ],
  },
  {
    number: 9,
    section: 'general-show-information',
    question: 'Where can I find updates about the Show?',
    answer: [
      'Updates will be published on the official Show website and through the organisers\' communication channels. Click the link on the website to get more info.',
    ],
  },
  {
    number: 10,
    section: 'tickets-and-entry',
    question: 'How much do tickets cost?',
    answer: [
      'Planned ticket categories include Early Bird, VIP, normal admission and weekend passes. The final prices, ticket conditions and availability are all available under the ticket tab on the website.',
    ],
  },
  {
    number: 11,
    section: 'tickets-and-entry',
    question: 'Where can I buy tickets?',
    answer: [
      'Online ticket sales via the website. There will also be sales at the door. No Cash!',
    ],
  },
  {
    number: 12,
    section: 'tickets-and-entry',
    question: 'Can I buy tickets at the door?',
    answer: [
      'Yes, with debit or credit cards. No Cash!',
    ],
  },
  {
    number: 13,
    section: 'tickets-and-entry',
    question: 'What is included in each ticket type?',
    answer: [
      'There are several ticket types and the website needs to be checked for further details.',
    ],
  },
  {
    number: 14,
    section: 'tickets-and-entry',
    question: 'Are children admitted, and do they need tickets?',
    answer: [
      'All Children are welcome. Full ticket prices are applicable. Any unattended children will be potted, pruned and watered.',
    ],
  },
  {
    number: 15,
    section: 'tickets-and-entry',
    question: 'Can I get a refund if I cannot attend?',
    answer: [
      'Tickets can only be refunded via the OWZO link on the website. Tickets for the Symposium and WOSA Conference are not refundable, but they are transferrable. Please check the T&C’s On your ticket confirmation.',
    ],
  },
  {
    number: 16,
    section: 'tickets-and-entry',
    question: 'Can I use one ticket to attend on more than one day?',
    answer: [
      'No, you need a ticket for each day or a weekend pass.',
    ],
  },
  {
    number: 17,
    section: 'tickets-and-entry',
    question: 'Do I need to print my ticket?',
    answer: [
      'Tickets will be emailed to you and will include a QR code. This code can be used for entry at the venue.',
    ],
  },
  {
    number: 18,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Where is the venue?',
    answer: [
      'The Show will be held at Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, Stellenbosch, Western Cape. A map and directions should be provided on the website and will be emailed to you when you purchase a ticket.',
    ],
  },
  {
    number: 19,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Is parking available?',
    answer: [
      'Yes, secure parking is available at the show and the symposium.',
    ],
  },
  {
    number: 20,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Can I get to the venue by public transport?',
    answer: [
      'Visitors should plan their journey in advance. No public transport options will be arranged by the show committee. Taxis and app-based e-hailing transport may be alternatives, depending on availability. Should you want to book any e-hailing or taxi please follow safe protocols.',
    ],
  },
  {
    number: 21,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Is the venue wheelchair accessible?',
    answer: [
      'The Hangar ground floor is accessible to visitors with disabilities and mobility challenges, including wheelchair users.',
      'Some activities and events will take place on the mezzanine level, which is accessible only by stairs. One stairway may be suitable for some visitors using crutches, but neither stairway is wheelchair accessible. Visitors who may need assistance are encouraged to contact the organisers in advance.',
    ],
  },
  {
    number: 22,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Are accessible toilets available?',
    answer: [
      'Yes',
    ],
  },
  {
    number: 23,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Are there places to sit and rest?',
    answer: [
      'Yes, there will be a few benches and tables but not many.',
    ],
  },
  {
    number: 24,
    section: 'getting-to-the-venue-and-accessibility',
    question: 'Can I bring a guide dog or assistance animal?',
    answer: [
      'Only service dogs will be allowed.',
    ],
  },
  {
    number: 25,
    section: 'orchid-displays-judging-and-awards',
    question: 'Will the orchids be judged?',
    answer: [
      'Yes. Judging and awards form part of the National Orchid Show, recognising outstanding orchids and exhibitors.',
    ],
  },
  {
    number: 26,
    section: 'orchid-displays-judging-and-awards',
    question: 'Can I enter my own orchids for judging?',
    answer: [
      'All South African Orchid Council members who’s subscriptions are valid may enter orchids for judging. If you are unsure, please check with your society.',
    ],
  },
  {
    number: 27,
    section: 'orchid-displays-judging-and-awards',
    question: 'Can orchid societies create their own displays?',
    answer: [
      'All submitted orchids will be placed in the Show display. Regional Societies may also have their own displays by booking a stand. They will also be able to sell society plants on behalf of their members.',
    ],
  },
  {
    number: 28,
    section: 'orchid-displays-judging-and-awards',
    question: 'When can exhibitors set up their displays?',
    answer: [
      'The venue access period currently planned for the organisers is 21 September 2027 at 09:00 to 27 September 2027 at 16:00. The specific exhibitor setup, judging, public opening and dismantling times are published in the programme and will also be sent via email.',
    ],
  },
  {
    number: 29,
    section: 'orchid-displays-judging-and-awards',
    question: 'Can visitors photograph the orchids?',
    answer: [
      'Photography of all plants and exhibition stands are allowed. Should you take photographs of attendees or the public please ensure that you get their express permission should you wish to publish these on or in any public content.',
      'All rights are reserved by the management committee to use photographs of the event that are publicly available.',
    ],
  },
  {
    number: 30,
    section: 'orchid-displays-judging-and-awards',
    question: 'Will prize-winning orchids be identified?',
    answer: [
      'Yes, they will be identified and displayed prominently.',
    ],
  },
  {
    number: 31,
    section: 'orchid-sales-and-vendors',
    question: 'Will orchids be available to buy?',
    answer: [
      'Yes. Orchid sales are planned, with participating local and international vendors offering orchids and related growing supplies and accessories.',
    ],
  },
  {
    number: 32,
    section: 'orchid-sales-and-vendors',
    question: 'Which vendors will attend?',
    answer: [
      'The final vendor list will be published once participation is confirmed. The website will identify international guests and exhibitors.',
    ],
  },
  {
    number: 33,
    section: 'orchid-sales-and-vendors',
    question: 'Can I buy rare or unusual orchids?',
    answer: [
      'Vendors may offer a range of orchid species and hybrids, including unusual plants. Availability depends on each vendor\'s stock, so specific plants cannot be guaranteed.',
    ],
  },
  {
    number: 34,
    section: 'orchid-sales-and-vendors',
    question: 'Can I pay by card or electronic transfer?',
    answer: [
      'Payment methods will vary by vendor. However, we are encouraging a no-cash policy.',
    ],
  },
  {
    number: 35,
    section: 'orchid-sales-and-vendors',
    question: 'Can I reserve plants with a vendor before the Show?',
    answer: [
      'Most vendors are open to pre-orders. All such arrangements are between the buyer and the seller.',
    ],
  },
  {
    number: 36,
    section: 'orchid-sales-and-vendors',
    question: 'Can international visitors take orchids home with them?',
    answer: [
      'Not automatically. Taking live plants across international borders may require permits, phytosanitary documentation and compliance with import rules in the destination country. Visitors should check the requirements with the relevant authorities before purchasing plants for export.',
    ],
  },
  {
    number: 37,
    section: 'orchid-sales-and-vendors',
    question: 'Will vendors sell pots, fertilisers and other orchid supplies?',
    answer: [
      'There will be some vendors who will be selling supplies.',
    ],
  },
  {
    number: 38,
    section: 'symposium',
    question: 'What is the Orchid Symposium?',
    answer: [
      'The Symposium is an educational programme forming part of the National Orchid Show, bringing together knowledgeable speakers to share information about orchids, their cultivation, genetics, distribution, natural habitats and conservation.',
    ],
  },
  {
    number: 39,
    section: 'symposium',
    question: 'When and where will the Symposium take place?',
    answer: [
      'It will take place in conjunction with the September 2027 National Orchid Show. The planned symposium venue is separate from the main exhibition floor, with capacity for approximately 80 attendees. The SAOC Symposium will be held on the 24th September 2027.',
    ],
  },
  {
    number: 40,
    section: 'symposium',
    question: 'Who will be speaking at the Symposium?',
    answer: [
      'Speakers being considered include Lourens Grobler, Tinus Oberholzer, Michael Tibbs, Rob Fuchs, Elbert Wijaya and Hildegard Crous. The final programme and confirmed speakers should be published once arrangements have been finalised.',
    ],
  },
  {
    number: 41,
    section: 'symposium',
    question: 'Do I need a separate ticket for the Symposium?',
    answer: [
      'Yes, the tickets are sold separately from the show tickets.',
    ],
  },
  {
    number: 42,
    section: 'symposium',
    question: 'Is the Symposium suitable for beginners?',
    answer: [
      'The programme is expected to appeal to orchid enthusiasts with a range of experience. The final programme should identify the intended audience and the level of knowledge required for each session.',
    ],
  },
  {
    number: 43,
    section: 'symposium',
    question: 'Will refreshments be provided?',
    answer: [
      'Refreshments will be provided for all attendees. However not all food allergies and preferences can be accommodated.',
    ],
  },
  {
    number: 44,
    section: 'symposium',
    question: 'Can I attend only one Symposium session?',
    answer: [
      'A ticket is valid for all sessions. You are welcome to skip any that you are not interested in attending.',
    ],
  },
  {
    number: 45,
    section: 'symposium',
    question: 'Will presentations or recordings be available afterwards?',
    answer: [
      'Yes, presentations will be made available to attendees on request. For those who were not able to attend a consolidated pack of presentations can be provided at a fee.',
    ],
  },
  {
    number: 46,
    section: 'wosa-conference',
    question: 'What is WOSA?',
    answer: [
      'WOSA stands for Wild Orchids Southern Africa, an organisation focused on South Africa\'s wild orchids and their conservation.',
    ],
  },
  {
    number: 47,
    section: 'wosa-conference',
    question: 'What is the WOSA Conference?',
    answer: [
      'The 7th WOSA Conference will be held in conjunction with the National Orchid Show in September 2027. It is planned as a one-day event focusing on wild orchids and related conservation and botanical topics.',
    ],
  },
  {
    number: 48,
    section: 'wosa-conference',
    question: 'When and where will the WOSA Conference take place?',
    answer: [
      'The conference is planned for 25 September 2027 in Stellenbosch, in conjunction with the National Orchid Show. It will take place at the same venue as the SAOC Symposium.',
    ],
  },
  {
    number: 49,
    section: 'wosa-conference',
    question: 'Do I have to be a WOSA member to attend?',
    answer: [
      'No, anyone can attend.',
    ],
  },
  {
    number: 50,
    section: 'wosa-conference',
    question: 'How much does the WOSA Conference cost?',
    answer: [
      'All ticket prices are available on the website.',
    ],
  },
  {
    number: 51,
    section: 'wosa-conference',
    question: 'What is included in the WOSA Conference ticket?',
    answer: [
      'The conference and refrenshments.',
    ],
  },
  {
    number: 52,
    section: 'wosa-conference',
    question: 'Will there be discounted or Early Bird tickets?',
    answer: [
      'Yes, please check the website for more details.',
    ],
  },
  {
    number: 53,
    section: 'wosa-conference',
    question: 'Will the conference include speakers?',
    answer: [
      'Yes, a speaker programme is planned. The final speakers, presentation topics and timetable will be announced once confirmed.',
    ],
  },
  {
    number: 54,
    section: 'wosa-conference',
    question: 'Will refreshments and lunch be provided?',
    answer: [
      'Refreshments will be provided for all attendees. However not all food allergies and preferences can be accommodated.',
    ],
  },
  {
    number: 55,
    section: 'wosa-conference',
    question: 'Is the WOSA Conference accessible to wheelchair users?',
    answer: [
      'Yes, the venue is accessible.',
    ],
  },
  {
    number: 56,
    section: 'wosa-conference',
    question: 'How do I register for the WOSA Conference?',
    answer: [
      'Via the National Show website and ticket sales table.',
    ],
  },
  {
    number: 57,
    section: 'workshops-and-other-activities',
    question: 'Will there be orchid-growing workshops?',
    answer: [
      'Workshops are planned as part of the wider event programme. The topics, instructors, dates, costs and booking arrangements are to be confirmed. Please check on the website for updates.',
    ],
  },
  {
    number: 58,
    section: 'workshops-and-other-activities',
    question: 'Do I need to book workshops in advance?',
    answer: [
      'Yes, it is best to book in advance to avoid disappointment.',
    ],
  },
  {
    number: 59,
    section: 'workshops-and-other-activities',
    question: 'Are workshops suitable for beginners?',
    answer: [
      'There will be a mix of workshops. Most will be suitable for beginners.',
    ],
  },
  {
    number: 60,
    section: 'workshops-and-other-activities',
    question: 'Are workshop materials included in the price?',
    answer: [
      'Yes, workshop materials will be included.',
    ],
  },
  {
    number: 61,
    section: 'workshops-and-other-activities',
    question: 'Will there be guided tours or field trips?',
    answer: [
      'Yes, these will be published in the final programme and on the ticket sales.',
    ],
  },
  {
    number: 62,
    section: 'workshops-and-other-activities',
    question: 'Will there be an opening ceremony or cocktail evening?',
    answer: [
      'A cocktail will be held on Thursday evening from 6.30 pm. Tickets will be sold via the website.',
    ],
  },
  {
    number: 63,
    section: 'food-refreshments-and-facilities',
    question: 'Will food and drinks be available at the Show?',
    answer: [
      'Yes, there is a restaurant on site as well as other food and drink vendors.',
    ],
  },
  {
    number: 64,
    section: 'food-refreshments-and-facilities',
    question: 'Can I bring my own food and drinks?',
    answer: [
      'No food can be brought into the venue.',
    ],
  },
  {
    number: 65,
    section: 'food-refreshments-and-facilities',
    question: 'Will vegetarian, vegan or special-diet options be available?',
    answer: [
      'This may or may not be available depending on the vendors that are selected.',
    ],
  },
  {
    number: 66,
    section: 'food-refreshments-and-facilities',
    question: 'Will there be an ATM or cash facilities?',
    answer: [
      'No ATM facilities are available at the venue.',
    ],
  },
  {
    number: 67,
    section: 'food-refreshments-and-facilities',
    question: 'Is there a cloakroom or a place to store purchases?',
    answer: [
      'No, there is no cloakroom or storage facility available.',
    ],
  },
  {
    number: 75,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'How can I apply to exhibit at the Show?',
    answer: [
      'Email 2027national@gmail.com or compete the expression of interest on the website and we will get back to you.',
    ],
  },
  {
    number: 76,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'How can I book a vendor stand?',
    answer: [
      'Vendor booking information, stand sizes, fees, payment terms and application forms are provided on the website. The current planning includes approximately 30 vendor booths.',
    ],
  },
  {
    number: 77,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'When must vendor fees be paid?',
    answer: [
      'Once your application has been accepted you should make your payment to ensure that your stand is secured.',
    ],
  },
  {
    number: 78,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'What is the cancellation and refund policy for vendors?',
    answer: [
      'The current planning provides for no refunds during the final 90 days before the event. The final vendor agreement will specify cancellation conditions, exceptions and how cancellations by the organisers will be handled.',
    ],
  },
  {
    number: 79,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'Are international orchid vendors welcome?',
    answer: [
      'International vendors are part of the Show\'s plans. Participation will depend on the vendor arrangements and compliance with applicable import, plant health and other legal requirements.',
    ],
  },
  {
    number: 80,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'How can a business sponsor the Show?',
    answer: [
      'Businesses interested in supporting the National Orchid Show should contact the organising committee for sponsorship opportunities. The sponsorship prospectus, packages, benefits and contact details can be sent via email. Contact Lee-Ann at 2027national@gmail.com.',
    ],
  },
  {
    number: 81,
    section: 'exhibitors-vendors-and-sponsors',
    question: 'Can a company donate money or products?',
    answer: [
      'Yes, sponsorship and donations can be explored with the organising committee. Email Lee-Ann at 2027national@gmail.com',
    ],
  },
  {
    number: 82,
    section: 'policies-and-visitor-information',
    question: 'Are pets allowed?',
    answer: [
      'Only official service animals will be accommodated at the event.',
    ],
  },
  {
    number: 83,
    section: 'policies-and-visitor-information',
    question: 'Is smoking permitted?',
    answer: [
      'No smoking is permitted on the premises. A designated smoking area will be provided away from the building.',
    ],
  },
  {
    number: 84,
    section: 'policies-and-visitor-information',
    question: 'Is there a lost property service?',
    answer: [
      'Yes, there will be an information desk with assistants for any event or property loss.',
    ],
  },
  {
    number: 85,
    section: 'policies-and-visitor-information',
    question: 'What should I do if I need assistance during the event?',
    answer: [
      'Visitors should approach an event steward or the information desk.',
    ],
  },
  {
    number: 86,
    section: 'policies-and-visitor-information',
    question: 'Who can I contact with questions that are not answered here?',
    answer: [
      'Email 2027national@gmail.com',
    ],
  },
];

function faqId(number: number): string {
  return `showFaq-q${number}`;
}

// Keys derive from the document id, never random: a random key changes the document on every run.
function toBlocks(id: string, paragraphs: readonly string[]): PortableBlock[] {
  return paragraphs.map((text, index) => ({
    _type: 'block',
    _key: `${id}-b${index}`,
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: `${id}-s${index}`, text, marks: [] }],
  }));
}

export function buildDocuments(): FaqDocument[] {
  return QUESTIONS.map((entry) => {
    const id = faqId(entry.number);
    return {
      _id: id,
      _type: 'showFaq',
      question: entry.question,
      category: entry.section,
      order: entry.number,
      status: 'confirmed',
      active: true,
      answer: toBlocks(id, entry.answer),
    };
  });
}

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

function requireEnv(name: string, local: Record<string, string>): string {
  const value = process.env[name] ?? local[name];
  if (!value) throw new Error(`${name} is not set (environment or .env.local)`);
  return value;
}

function makeClient(): SanityClient {
  const local = readEnvLocal();
  return createClient({
    projectId: requireEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', local),
    dataset: requireEnv('NEXT_PUBLIC_SANITY_DATASET', local),
    token: requireEnv('SANITY_API_TOKEN', local),
    apiVersion: API_VERSION,
    useCdn: false,
  });
}

interface RevisionRow {
  _id: string;
  _rev: string;
}

async function currentRevisions(client: SanityClient): Promise<RevisionRow[]> {
  return client.fetch<RevisionRow[]>('*[_type == "showFaq"]{_id, _rev} | order(_id asc)');
}

async function backupExisting(client: SanityClient): Promise<string> {
  const existing = await client.fetch<unknown[]>('*[_type == "showFaq"] | order(_id asc)');
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `showFaq-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(existing, null, 2));
  return file;
}

async function apply(documents: FaqDocument[]): Promise<void> {
  const client = makeClient();
  const before = await currentRevisions(client);
  const backupFile = await backupExisting(client);
  const after = await currentRevisions(client);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('showFaq documents changed while backing up; nothing was written. Re-run.');
  }
  const transaction = client.transaction();
  for (const doc of documents) transaction.createOrReplace(doc);
  for (const id of LEGACY_IDS) transaction.delete(id);
  const result = await transaction.commit();
  process.stdout.write(
    `${JSON.stringify({
      mode: 'apply',
      backup: backupFile,
      written: documents.length,
      deleted: LEGACY_IDS.length,
      transactionId: result.transactionId,
    })}\n`
  );
}

async function main(): Promise<void> {
  const documents = buildDocuments();
  if (process.argv.includes(APPLY_FLAG)) {
    await apply(documents);
    return;
  }
  process.stdout.write(
    `${JSON.stringify({ mode: 'dry-run', documents, delete: [...LEGACY_IDS] }, null, 2)}\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`seed-show-faq failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

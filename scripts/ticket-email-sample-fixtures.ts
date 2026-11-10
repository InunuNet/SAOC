import type { TicketEmailKey } from '@/lib/ticket-email-copy';
import type { TicketPdfSchedule } from '@/lib/ticket-pdf';

/**
 * ticket-email-samples (F2) — the made-up order data behind the sample PDFs. Copied from the
 * frozen goldens/fixtures.json: names, booking references and the amount are not real, and the
 * cover page says so. Dates and times are the ones in Lee-Ann's copy; nothing is invented.
 */

export const SAMPLE_FIRST_NAME = 'Thandi';
export const SAMPLE_PRICE_RAND = 100;
export const SAMPLE_VENUE_NAME = 'Hangar 25, Orca Aero Solutions';
export const SAMPLE_SHOW_DATES = '23–26 September 2027';
export const SAMPLE_SHOW_URL = 'nos.saoc.co.za';
export const SAMPLE_QUESTIONS_EMAIL = 'info@saoc.co.za';

export const SAMPLE_OPENING_TIMES = [
  { label: 'Friday, 24 September 2027', value: '09:00–17:00' },
  { label: 'Saturday, 25 September 2027', value: '09:00–17:00' },
  { label: 'Sunday, 26 September 2027', value: '09:00–16:00' },
];

export const SAMPLE_EMERGENCY = [
  { number: '10111', label: 'Police (national)' },
  { number: '10177', label: 'Ambulance and fire (national)' },
  { number: '112', label: 'All emergencies, from a mobile phone' },
];

export interface SampleOrder {
  key: TicketEmailKey;
  slug: string;
  title: string;
  visitorName: string;
  quantity: number;
  bookingReference: string;
  /** The visit day the buyer chose (YYYY-MM-DD); only day-based tickets have one. */
  chosenDay: string | null;
  /** What the ticket PDF prints as its date; null renders the "To be confirmed" pill. */
  schedule: TicketPdfSchedule | null;
}

const HOLDER = 'Thandi Nkosi';
const STUB_NUMERAL = 'XIX'; // the 19th show: printed on the two programme tickets only
const dateOnly = (
  dateText: string,
  timeText: string | null = null,
  numeral: string | null = null
): TicketPdfSchedule => ({
  eyebrow: null,
  numeral,
  dateText,
  timeText,
});

export const SAMPLE_ORDERS: readonly SampleOrder[] = [
  {
    key: 'early-bird',
    slug: 'early-bird',
    title: 'Early Bird Exhibition Ticket',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0001',
    chosenDay: '2027-09-25',
    schedule: dateOnly('Saturday, 25 September 2027'),
  },
  {
    key: 'day-visitor',
    slug: 'day-visitor',
    title: 'Day Visitor Ticket',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0002',
    chosenDay: '2027-09-24',
    schedule: dateOnly('Friday, 24 September 2027'),
  },
  {
    key: 'weekend-pass',
    slug: 'weekend-pass',
    title: 'Weekend Pass',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0003',
    chosenDay: null,
    schedule: dateOnly('Friday 24, Saturday 25 and Sunday 26 September 2027'),
  },
  {
    key: 'vip',
    slug: 'vip',
    title: 'VIP Ticket',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0004',
    chosenDay: null,
    schedule: dateOnly('Thursday, 23 September 2027', '16:00–18:30'),
  },
  {
    key: 'sunset-cocktails',
    slug: 'sunset-cocktails-single',
    title: 'Sunset Cocktails',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0005',
    chosenDay: null,
    schedule: null,
  },
  {
    key: 'saoc-symposium',
    slug: 'saoc-symposium',
    title: 'SAOC Symposium',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0006',
    chosenDay: null,
    schedule: dateOnly('Friday, 24 September 2027', null, STUB_NUMERAL),
  },
  {
    key: 'wosa-conference',
    slug: 'wosa-conference',
    title: 'WOSA Conference',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0007',
    chosenDay: null,
    schedule: dateOnly('Saturday, 25 September 2027', null, STUB_NUMERAL),
  },
  {
    key: 'saoc-wosa-joint',
    slug: 'saoc-wosa-joint',
    title: 'SAOC/WOSA Joint Ticket',
    visitorName: HOLDER,
    quantity: 1,
    bookingReference: 'NOS-SAMPLE-0008',
    chosenDay: null,
    schedule: dateOnly('Friday, 24 and Saturday, 25 September 2027'),
  },
];

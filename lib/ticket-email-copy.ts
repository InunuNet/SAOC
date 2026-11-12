/**
 * ticket-email-samples (F1) — Lee-Ann's per-ticket-type confirmation emails, from her Drive doc
 * "Ticket information for purchasers.docx". A pure table: no imports of anything that sends,
 * reads data or takes payment, so the sample generator and the live send path share it.
 *
 * Her wording is verbatim. Her soft line breaks (VIP date and time, the sign-off) are one
 * `text` block with two `lines`. A part of an email she left out is listed in `pendingRows` and
 * renders as the visible text "[To be confirmed]", never as invented copy. The joint ticket slug
 * `saoc-wosa-joint` is provisional: no joint ticket type exists yet.
 *
 * `{tokens}` in a string are filled from the order at render time (see lib/ticket-type-email.ts).
 */

export const PENDING_MARKER = '[To be confirmed]';

export type TicketEmailKey =
  | 'early-bird'
  | 'day-visitor'
  | 'weekend-pass'
  | 'vip'
  | 'sunset-cocktails'
  | 'saoc-symposium'
  | 'wosa-conference'
  | 'saoc-wosa-joint';

export interface CopyDetailRow {
  label: string;
  value: string;
}

export type CopyBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'details'; rows: CopyDetailRow[] };

export interface TicketEmailCopy {
  /** null: Lee-Ann gave no subject line, so it renders as "[To be confirmed]". */
  subject: string | null;
  /** Labels of parts missing from her copy; each renders as "<label>: [To be confirmed]". */
  pendingRows: string[];
  blocks: CopyBlock[];
}

const VENUE_PARKING: readonly CopyBlock[] = [
  { kind: 'heading', text: 'Venue and parking' },
  { kind: 'text', lines: ['Hangar 25, Stellenbosch Airfield, Stellenbosch, Western Cape (R44).'] },
  { kind: 'text', lines: ['Parking will be available at the venue. Further parking and access instructions will be provided closer to the event.'] },
];

const TICKET_TRANSFERS: readonly CopyBlock[] = [
  { kind: 'heading', text: 'Ticket transfers' },
  { kind: 'text', lines: ['If you are unable to attend, you may transfer your ticket to another person. Please give the new ticket holder a printed copy of the original ticket, including its QR code. The printed ticket must be presented at the entrance for scanning.'] },
  { kind: 'text', lines: ['Each QR code is valid for one ticket entitlement only and may not be used by more than one person.'] },
];

const REFUND_POLICY: readonly CopyBlock[] = [
  { kind: 'heading', text: 'Cancellation and refund policy' },
  { kind: 'text', lines: ['Cancellation requests must be submitted in writing to the organisers, quoting your booking reference.'] },
  { kind: 'text', lines: ['Refunds are calculated on the original ticket price, less the applicable cancellation percentage and a 5% administration fee:'] },
  { kind: 'list', items: [
      'More than 60 days before the event: 90% refund, less the 5% administration fee (85% of the original ticket price).',
      '30–60 days before the event: 75% refund, less the 5% administration fee (70% of the original ticket price).',
      '14–29 days before the event: 50% refund, less the 5% administration fee (45% of the original ticket price).',
      'Less than 14 days before the event: Requests will be considered individually. Any approved refund will be subject to the 5% administration fee.',
  ] },
  { kind: 'text', lines: ['The administration fee covers transaction and processing costs incurred by the organisers, including payment gateway and bank charges.'] },
  { kind: 'text', lines: ['If the organisers cancel the event, affected ticket holders will receive a full refund without an administration fee.'] },
  { kind: 'text', lines: ['Approved refunds will be processed within 14 business days.'] },
];

export const TICKET_EMAIL_COPY: Record<TicketEmailKey, TicketEmailCopy> = {
  'early-bird': {
    subject: 'Your Early Bird Ticket – National Orchid Show – Western Cape 2027',
    pendingRows: [],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your Early Bird Exhibition Ticket for the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['We look forward to welcoming you to Hangar 25 at Stellenbosch Airfield for an exceptional celebration of orchids.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'Early Bird Exhibition Ticket' },
          { label: 'Ticket holder:', value: '{visitor_name}' },
          { label: 'Number of tickets:', value: '{ticket_quantity}' },
          { label: 'Valid for:', value: '{selected_visit_date}' },
          { label: 'Amount paid:', value: '{amount_paid}' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your ticket and entry' },
      { kind: 'text', lines: ['Your ticket is valid for one day only, on the date selected when making your booking.'] },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, so that the QR code can be scanned at the entrance.'] },
      { kind: 'heading', text: 'Exhibition opening hours' },
      { kind: 'list', items: [
          'Friday, 24 September 2027: 09:00–17:00',
          'Saturday, 25 September 2027: 09:00–17:00',
          'Sunday, 26 September 2027: 09:00–16:00',
      ] },
      ...VENUE_PARKING,
      ...TICKET_TRANSFERS,
      ...REFUND_POLICY,
      { kind: 'text', lines: ['We look forward to seeing you!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact us at info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'day-visitor': {
    subject: 'Your Day Visitor Ticket – National Orchid Show – Western Cape 2027',
    pendingRows: [],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your Day Visitor Ticket for the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['We look forward to welcoming you to Hangar 25 at Stellenbosch Airfield.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'Day Visitor Ticket' },
          { label: 'Ticket holder:', value: '{visitor_name}' },
          { label: 'Number of tickets:', value: '{ticket_quantity}' },
          { label: 'Valid for:', value: '{selected_visit_date}' },
          { label: 'Amount paid:', value: '{amount_paid}' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your ticket and entry' },
      { kind: 'text', lines: ['Your ticket is valid for one selected day only. It does not provide access on the other exhibition days.'] },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, so that the QR code can be scanned at the entrance.'] },
      { kind: 'heading', text: 'Exhibition opening hours' },
      { kind: 'list', items: [
          'Friday, 24 September 2027: 09:00–17:00',
          'Saturday, 25 September 2027: 09:00–17:00',
          'Sunday, 26 September 2027: 09:00–16:00',
      ] },
      ...VENUE_PARKING,
      ...TICKET_TRANSFERS,
      ...REFUND_POLICY,
      { kind: 'text', lines: ['We look forward to welcoming you!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact us at info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'weekend-pass': {
    subject: 'Your Weekend Pass – National Orchid Show – Western Cape 2027',
    pendingRows: [],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your Weekend Pass for the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['Your Weekend Pass gives you the opportunity to enjoy the exhibition over all three public show days. We look forward to welcoming you!'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'Weekend Pass' },
          { label: 'Ticket holder:', value: '{visitor_name}' },
          { label: 'Number of tickets:', value: '{ticket_quantity}' },
          { label: 'Valid for:', value: 'Friday 24, Saturday 25 and Sunday 26 September 2027' },
          { label: 'Amount paid:', value: '{amount_paid}' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your ticket and entry' },
      { kind: 'text', lines: ['Your Weekend Pass is valid for all three public exhibition days:'] },
      { kind: 'list', items: [
          'Friday, 24 September 2027: 09:00–17:00',
          'Saturday, 25 September 2027: 09:00–17:00',
          'Sunday, 26 September 2027: 09:00–16:00',
      ] },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, each time you visit. Your QR code will be validated for each permitted day of entry. It is not necessary to obtain a separate ticket for each day.'] },
      ...VENUE_PARKING,
      ...TICKET_TRANSFERS,
      ...REFUND_POLICY,
      { kind: 'text', lines: ['Enjoy the show!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact us at info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'vip': {
    subject: 'Your VIP Ticket – National Orchid Show – Western Cape 2027',
    pendingRows: [],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your VIP Ticket for the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['We are delighted that you will be joining us for this special opening event. Your VIP experience offers an opportunity to enjoy the show ahead of the public exhibition.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'VIP Ticket' },
          { label: 'Ticket holder:', value: '{visitor_name}' },
          { label: 'Number of tickets:', value: '{ticket_quantity}' },
          { label: 'Date:', value: 'Thursday, 23 September 2027' },
          { label: 'Time:', value: '16:00–18:30' },
          { label: 'Amount paid:', value: '{amount_paid}' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your VIP experience' },
      { kind: 'text', lines: ['Your VIP ticket provides access to the National Orchid Show during the exclusive VIP session:'] },
      { kind: 'text', lines: ['Thursday, 23 September 2027', '16:00–18:30'] },
      { kind: 'text', lines: ['Please arrive in good time to allow for ticket scanning and entry.'] },
      { kind: 'text', lines: ['Further details regarding the VIP programme and any confirmed inclusions will be communicated closer to the event.'] },
      ...VENUE_PARKING,
      ...TICKET_TRANSFERS,
      ...REFUND_POLICY,
      { kind: 'text', lines: ['We look forward to welcoming you!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact us at info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'sunset-cocktails': {
    subject: '[To be confirmed]',
    pendingRows: ['Date', 'Time', 'Venue'],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your tickets for Sunset Cocktails at the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['We are delighted that you will be joining us for an enjoyable evening as part of the National Orchid Show celebrations.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'Sunset Cocktails' },
          { label: 'Booking name:', value: '{visitor_name}' },
          { label: 'Number of people attending:', value: '{ticket_quantity}' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your ticket and entry' },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, so that the QR code can be scanned on arrival.'] },
      { kind: 'text', lines: ['If you are unable to attend, you may transfer your ticket to another person. Please provide the new ticket holder with a printed copy of the original ticket, including its QR code. The printed ticket must be presented at the entrance for scanning.'] },
      { kind: 'text', lines: ['Each QR code is valid for one ticket entitlement only and may not be used by more than one person.'] },
      ...REFUND_POLICY,
      { kind: 'text', lines: ['We look forward to sharing a wonderful evening with you!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact us at info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'saoc-symposium': {
    subject: 'Your SAOC Symposium Booking – National Orchid Show – Western Cape 2027',
    pendingRows: ['Venue', 'Time'],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your ticket for the SAOC Symposium, presented as part of the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['We look forward to welcoming you for a day of learning, discussion and knowledge-sharing focused on orchids.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'SAOC Symposium' },
          { label: 'Booking name:', value: '{visitor_name}' },
          { label: 'Number of attendees:', value: '{ticket_quantity}' },
          { label: 'Event date:', value: 'Friday, 24 September 2027' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your ticket and entry' },
      { kind: 'text', lines: ['Your ticket provides access to the SAOC Symposium on Friday, 24 September 2027.'] },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, so that the QR code can be scanned on arrival.'] },
      { kind: 'text', lines: ['Further programme and venue information will be communicated to registered attendees closer to the event.'] },
      { kind: 'heading', text: 'Ticket transfers' },
      { kind: 'text', lines: ['If you are unable to attend, you may transfer your ticket to another person. Please provide the new attendee with a printed copy of the original ticket, including its QR code. The printed ticket must be presented at registration for scanning.'] },
      { kind: 'text', lines: ['Each QR code is valid for one ticket entitlement only and may not be used by more than one person.'] },
      ...REFUND_POLICY,
      { kind: 'text', lines: ['We look forward to welcoming you to the symposium!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'wosa-conference': {
    subject: 'Your WOSA Conference Booking – National Orchid Show – Western Cape 2027',
    pendingRows: ['Venue', 'Time'],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your ticket for the 7th WOSA Conference, presented as part of the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['The conference brings together people with an interest in wild orchids and provides an opportunity to share knowledge, research and conservation experiences.'] },
      { kind: 'text', lines: ['We look forward to welcoming you for this special event.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'WOSA Conference' },
          { label: 'Booking name:', value: '{visitor_name}' },
          { label: 'Number of attendees:', value: '{ticket_quantity}' },
          { label: 'Event date:', value: 'Saturday, 25 September 2027' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your ticket and entry' },
      { kind: 'text', lines: ['Your ticket provides access to the WOSA Conference on Saturday, 25 September 2027.'] },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, so that the QR code can be scanned on arrival.'] },
      { kind: 'text', lines: ['Further programme and venue information will be communicated to registered attendees closer to the event.'] },
      { kind: 'heading', text: 'Ticket transfers' },
      { kind: 'text', lines: ['If you are unable to attend, you may transfer your ticket to another person. Please provide the new attendee with a printed copy of the original ticket, including its QR code. The printed ticket must be presented at registration for scanning.'] },
      { kind: 'text', lines: ['Each QR code is valid for one ticket entitlement only and may not be used by more than one person.'] },
      ...REFUND_POLICY,
      { kind: 'text', lines: ['We look forward to welcoming you to the WOSA Conference!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
  'saoc-wosa-joint': {
    subject: 'Your SAOC Symposium and WOSA Conference Booking – National Orchid Show – Western Cape 2027',
    pendingRows: ['Venue', 'Time'],
    blocks: [
      { kind: 'text', lines: ['Dear {first_name},'] },
      { kind: 'text', lines: ['Thank you for booking your SAOC/WOSA Joint Ticket for the National Orchid Show – Western Cape 2027.'] },
      { kind: 'text', lines: ['We are delighted that you will be joining us for both the SAOC Symposium and the 7th WOSA Conference.'] },
      { kind: 'text', lines: ['Your joint ticket provides access to both events, offering two days of presentations, knowledge-sharing and discussion about orchids.'] },
      { kind: 'heading', text: 'Your booking details' },
      {
        kind: 'details',
        rows: [
          { label: 'Booking reference:', value: '{booking_reference}' },
          { label: 'Ticket type:', value: 'SAOC/WOSA Joint Ticket' },
          { label: 'Booking name:', value: '{visitor_name}' },
          { label: 'Number of attendees:', value: '{ticket_quantity}' },
          { label: 'Payment status:', value: '{payment_status}' },
        ],
      },
      { kind: 'heading', text: 'Your event access' },
      { kind: 'text', lines: ['Your joint ticket includes access to both of the following events:'] },
      { kind: 'text', lines: ['SAOC Symposium'] },
      { kind: 'list', items: [
          'Friday, 24 September 2027',
      ] },
      { kind: 'text', lines: ['7th WOSA Conference'] },
      { kind: 'list', items: [
          'Saturday, 25 September 2027',
      ] },
      { kind: 'text', lines: ['Please bring your ticket, either printed or displayed on your mobile device, on both days. Your QR code will be validated for each event included in your booking.'] },
      { kind: 'text', lines: ['Further programme and venue information will be communicated to registered attendees closer to the events.'] },
      { kind: 'heading', text: 'Ticket transfers' },
      { kind: 'text', lines: ['If you are unable to attend, you may transfer your ticket to another person. Please provide the new attendee with a printed copy of the original ticket, including its QR code. The printed ticket must be presented at registration for scanning.'] },
      { kind: 'text', lines: ['Each QR code is valid for one ticket entitlement only and may not be used by more than one person.'] },
      { kind: 'heading', text: 'Cancellation and refund policy' },
      { kind: 'text', lines: ['Cancellation requests must be submitted in writing to the organisers, quoting your booking reference.'] },
      { kind: 'text', lines: ['Refunds are calculated on the original ticket price, less the applicable cancellation percentage and a 5% administration fee:'] },
      { kind: 'list', items: [
          'More than 60 days before the events: 90% refund, less the 5% administration fee (85% of the original ticket price).',
          '30–60 days before the events: 75% refund, less the 5% administration fee (70% of the original ticket price).',
          '14–29 days before the events: 50% refund, less the 5% administration fee (45% of the original ticket price).',
          'Less than 14 days before the events: Requests will be considered individually. Any approved refund will be subject to the 5% administration fee.',
      ] },
      { kind: 'text', lines: ['The administration fee covers transaction and processing costs incurred by the organisers, including payment gateway and bank charges.'] },
      { kind: 'text', lines: ['If the organisers cancel either event, the organisers will communicate the arrangements applicable to the affected ticket entitlement. If both events are cancelled, affected ticket holders will receive a full refund without an administration fee.'] },
      { kind: 'text', lines: ['Approved refunds will be processed within 14 business days.'] },
      { kind: 'text', lines: ['We look forward to welcoming you to both events!'] },
      { kind: 'text', lines: ['For further information, please visit nos.saoc.co.za or contact info@saoc.co.za.'] },
      { kind: 'text', lines: ['Kind regards,', 'The National Orchid Show – Western Cape 2027 Organising Committee'] },
    ],
  },
};

const SLUG_TO_KEY: Readonly<Record<string, TicketEmailKey>> = {
  'early-bird': 'early-bird',
  'day-visitor': 'day-visitor',
  'weekend-pass': 'weekend-pass',
  'weekend-pass-early-bird': 'weekend-pass',
  vip: 'vip',
  'sunset-cocktails-single': 'sunset-cocktails',
  'saoc-symposium': 'saoc-symposium',
  'wosa-conference': 'wosa-conference',
  'saoc-wosa-joint': 'saoc-wosa-joint',
};

/** The email for a stored ticket type slug, or null when none is mapped (generic email is sent). */
export function ticketEmailKeyForSlug(slug: string): TicketEmailKey | null {
  return Object.prototype.hasOwnProperty.call(SLUG_TO_KEY, slug) ? SLUG_TO_KEY[slug] : null;
}

/** The order values the `{tokens}` in the copy stand for; null renders as "[To be confirmed]". */
export interface TicketEmailValues {
  firstName: string | null;
  visitorName: string | null;
  quantity: string | null;
  bookingReference: string | null;
  amountPaid: string | null;
  paymentStatus: string | null;
  visitDate: string | null;
}

const TOKEN_PATTERN = /\{(\w+)\}/g;

const TOKEN_VALUE: Readonly<Record<string, (values: TicketEmailValues) => string | null>> = {
  first_name: (v) => v.firstName,
  visitor_name: (v) => v.visitorName,
  ticket_quantity: (v) => v.quantity,
  booking_reference: (v) => v.bookingReference,
  amount_paid: (v) => v.amountPaid,
  payment_status: (v) => v.paymentStatus,
  selected_visit_date: (v) => v.visitDate,
};

/** Fills the `{tokens}` of one copy string. An unknown token is a copy bug and fails loudly. */
export function fillTokens(text: string, values: TicketEmailValues): string {
  return text.replace(TOKEN_PATTERN, (_match, name: string) => {
    const pick = TOKEN_VALUE[name];
    if (!pick) throw new Error(`ticket-email-copy: unknown token {${name}}`);
    return pick(values) || PENDING_MARKER;
  });
}

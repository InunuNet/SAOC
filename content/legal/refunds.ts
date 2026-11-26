import type { TitledLegalDocument } from '@/components/legal/types';

// Master text: Lee-Ann's final Refund and Cancellation Policy (Drive 1Hn0qNYO3_xu2Np6f4BPneLFZZH5tREjS),
// verbatim. Do not reword; change only when she issues a new version.
export const REFUND_POLICY_TITLE = 'SAOC REFUND AND CANCELLATION POLICY';
export const REFUND_POLICY_LAST_UPDATED = '01/12/2026';

/** The master's own sentences for the cancellation schedule, the administration fee and the transfer rule. */
export const CANCELLATION_SCHEDULE_LINES: readonly string[] = [
  'The following schedule applies, unless the event listing states a different schedule before you buy. It is based on how much written notice you give before the event start date. For a multi-day event, the start date is the first day of the event:',
  '30 days or more before the event: a refund of 90% of the ticket price, less the administration fee.',
  'Less than 30 days but 14 days or more before the event: a refund of 50% of the ticket price, less the administration fee.',
  'Less than 14 days before the event: no refund, unless your place is resold or the section on death or hospitalisation applies.',
  'Where you cancel a ticket under the schedule above, SAOC deducts an administration fee of 5% of the ticket price. The fee covers payment gateway and bank charges and the cost of processing your request. SAOC does not charge the fee if it cancels an event, if it cannot provide your place, or if the section on death or hospitalisation applies.',
  'As an alternative to cancelling, you may transfer your ticket to another person, free of charge, up to 7 days before the event. To do so, contact SAOC with your booking reference and the full name and email address of the new ticket holder.',
  'SAOC will cancel the original ticket and its QR code and issue a new ticket to the new holder. Please do not give the new holder a copy of the original ticket, because its QR code will no longer work. A ticket for Sunset Cocktails may be transferred only to a person aged 18 or older.',
];

export const REFUND_POLICY: TitledLegalDocument = {
  title: REFUND_POLICY_TITLE,
  blocks: [
    { kind: 'p', text: 'This policy applies to tickets for the National Orchid Show and other SAOC events. It covers admission, conference, workshop, field trip and Sunset Cocktails tickets. It forms part of the Website Terms and Conditions. The version in force on the day you buy your ticket applies to that ticket.' },
    { kind: 'h2', text: 'Refunds' },
    { kind: 'p', text: 'Where a refund is due under this policy, it will be issued back to the original payment method used at checkout, via the payment gateway used to process that purchase. SAOC will pay the refund within 14 business days of the date on which it becomes due. Your bank or card issuer may take longer to show it. SAOC will not deduct gateway fees from a refund. It will deduct the administration fee only where this policy says so. A business day is any day other than a Saturday, Sunday or public holiday in South Africa.' },
    { kind: 'h2', text: 'Cancellations by SAOC' },
    { kind: 'p', text: 'If SAOC cancels an event, workshop, field trip or other activity outright, SAOC will tell the ticket holders for that activity, using the contact details supplied at checkout. They will receive a full refund of everything they paid for the ticket, including any booking fee, with no administration fee and no other deduction. This applies regardless of how close to the event the cancellation is announced. A ticket holder may choose a credit or an alternative arrangement instead, but SAOC will not require one.' },
    { kind: 'h2', text: 'If SAOC cannot provide your place' },
    { kind: 'p', text: 'If SAOC cannot give you a place that you have paid for, for example because an event or activity is full, SAOC will refund everything you paid. It will add interest at the rate set by law. It will also pay the reasonable costs that directly result from its failure. SAOC may offer you a comparable place instead. You may accept or refuse that offer.' },
    { kind: 'h2', text: 'If SAOC postpones or materially changes an event' },
    { kind: 'p', text: 'If SAOC postpones an event, or changes its date, venue or programme in a way that materially affects your ticket, SAOC will tell you as soon as reasonably possible. You may then keep your ticket for the changed event or cancel it for a full refund. You must tell SAOC which you choose within 14 days of SAOC\'s notice.' },
    { kind: 'h2', text: 'Cancellations by you' },
    { kind: 'p', text: 'To cancel a ticket, send SAOC a written request that quotes your booking reference. You may use email or the contact page on the website. The date on which SAOC receives your request is the date of cancellation.' },
    { kind: 'p', text: 'The following tickets can be cancelled under this policy:' },
    {
      kind: 'list',
      items: [
        'Admission tickets to the National Orchid Show;',
        'Conference tickets;',
        'Workshop tickets;',
        'Field trip tickets; or',
        'Sunset Cocktails tickets.',
      ],
    },
    { kind: 'p', text: 'The following schedule applies, unless the event listing states a different schedule before you buy. It is based on how much written notice you give before the event start date. For a multi-day event, the start date is the first day of the event:' },
    {
      kind: 'list',
      items: [
        '30 days or more before the event: a refund of 90% of the ticket price, less the administration fee.',
        'Less than 30 days but 14 days or more before the event: a refund of 50% of the ticket price, less the administration fee.',
        'Less than 14 days before the event: no refund, unless your place is resold or the section on death or hospitalisation applies.',
      ],
    },
    { kind: 'h2', text: 'Administration fee' },
    { kind: 'p', text: 'Where you cancel a ticket under the schedule above, SAOC deducts an administration fee of 5% of the ticket price. The fee covers payment gateway and bank charges and the cost of processing your request. SAOC does not charge the fee if it cancels an event, if it cannot provide your place, or if the section on death or hospitalisation applies.' },
    { kind: 'h2', text: 'Resale of your place' },
    { kind: 'p', text: 'Workshops, field trips, Sunset Cocktails and some other tickets have a limited number of places. If you cancel one of these tickets, SAOC will take reasonable steps to resell your place, including by offering it to anyone on a waiting list. If SAOC resells your place before the event, you will receive a refund of the full ticket price, less the administration fee, whatever notice you gave.' },
    { kind: 'h2', text: 'Death or hospitalisation' },
    { kind: 'p', text: 'SAOC will not charge any cancellation fee if you cannot attend because the person for whom the ticket was bought has died or has been admitted to hospital. In that case you will receive a full refund of the ticket price, with no administration fee. SAOC may ask for reasonable proof, such as a death certificate or a letter from the hospital.' },
    { kind: 'h2', text: 'Seven-day cooling-off right for online purchases' },
    { kind: 'p', text: 'If you bought your ticket online, you may have the right under section 44 of the Electronic Communications and Transactions Act 25 of 2002 to cancel it within seven days of buying it. You do not need to give a reason and you will pay no penalty. This right does not apply to tickets for events, workshops, field trips and other leisure services that SAOC will provide on a specific date or within a specific period, such as admission to the National Orchid Show. Where the right applies, SAOC will refund you in full within 30 days of your cancellation.' },
    { kind: 'h2', text: 'Transferring your ticket' },
    { kind: 'p', text: 'As an alternative to cancelling, you may transfer your ticket to another person, free of charge, up to 7 days before the event. To do so, contact SAOC with your booking reference and the full name and email address of the new ticket holder.' },
    { kind: 'p', text: 'SAOC will cancel the original ticket and its QR code and issue a new ticket to the new holder. Please do not give the new holder a copy of the original ticket, because its QR code will no longer work. A ticket for Sunset Cocktails may be transferred only to a person aged 18 or older.' },
    { kind: 'h2', text: 'Conference tickets' },
    { kind: 'p', text: 'Conference tickets are named-registrant products and follow the same cancellation schedule above. A conference ticket may be transferred as set out under Transferring your ticket. The full name of the new registrant is required.' },
    { kind: 'h2', text: 'Vendor stand bookings' },
    { kind: 'p', text: 'Vendor stand bookings are a separate product with their own cancellation terms, set out in the vendor registration agreement, and are not covered by this policy. See vendor registration for details.' },
    { kind: 'h2', text: 'Exceptional circumstances' },
    { kind: 'p', text: 'Apart from the cases covered under Death or hospitalisation, requests relating to medical emergencies, bereavement, or other exceptional circumstances will be considered on a case-by-case basis, and SAOC may waive the administration fee and any cancellation charge at its discretion. Contact us to discuss your situation.' },
    { kind: 'h2', text: 'Your legal rights' },
    { kind: 'p', text: 'Nothing in this policy limits any right that you have under the Consumer Protection Act 68 of 2008, the Electronic Communications and Transactions Act 25 of 2002 or any other law. If this policy and the law differ, the law applies.' },
    { kind: 'h2', text: 'How to request a refund or cancellation' },
    { kind: 'p', text: 'To request a refund or cancellation, or to ask a question about an existing booking, please contact us with your order details. Related conditions of sale are set out in our Website Terms and Conditions, and details of how we handle your information appear in our Privacy Policy.' },
    { kind: 'p', text: '**Last updated: 01/12/2026**' },
  ],
};

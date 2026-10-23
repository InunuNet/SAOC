// email-shell contract fixtures: one entry per template, fictional props only, shared by the
// check script and (by design) scripts/email-shell-test-send.ts. `family` is the expected
// EmailShell family.
import { createElement as h, type ReactElement } from 'react';
import * as OrderConfirmation_m from '../../../emails/OrderConfirmation';
import * as VendorPaymentConfirmation_m from '../../../emails/VendorPaymentConfirmation';
import * as VendorApplicationConfirmation_m from '../../../emails/VendorApplicationConfirmation';
import * as VendorApprovalConfirmation_m from '../../../emails/VendorApprovalConfirmation';
import * as VendorRegistrationConfirmation_m from '../../../emails/VendorRegistrationConfirmation';
import * as VendorStandPaymentReady_m from '../../../emails/VendorStandPaymentReady';
import * as SupporterRegistrationConfirmation_m from '../../../emails/SupporterRegistrationConfirmation';
import * as VendorApplicationAdminNotice_m from '../../../emails/VendorApplicationAdminNotice';
import * as VendorSubmissionAdminNotice_m from '../../../emails/VendorSubmissionAdminNotice';
import * as VendorPaymentAdminNotice_m from '../../../emails/VendorPaymentAdminNotice';
import * as ReconciliationAlert_m from '../../../emails/ReconciliationAlert';
import * as ContactConfirmation_m from '../../../emails/ContactConfirmation';

// tsx loads the .tsx templates as CJS under ESM: the default export may arrive wrapped.
const d = <T,>(m: { default: T }): T => ((m.default as { default?: T }).default ?? m.default);

export interface Fixture {
  name: string;
  /** template file under emails/ when it differs from `name` (a second fixture of the same template) */
  file?: string;
  family: 'A' | 'B' | 'C' | 'D';
  element: ReactElement;
}

const BIZ = 'Fictional Orchids (Pty) Ltd';
const PERSON = 'Test Person';

export const FIXTURES: Fixture[] = [
  {
    name: 'OrderConfirmation',
    family: 'A',
    element: h(d(OrderConfirmation_m), {
      buyerName: PERSON,
      recoveryUrl: 'https://example.com/recover/abc',
      // confirmed visit values: same data the ticket PDF page 1 prints (ticket-pdf/goldens/fixture-order.json)
      visit: {
        pendingLabel: null,
        venueName: 'The Hangar, Stellenbosch Flying Club',
        venueAddress: 'Stellenbosch Airfield, R44, Stellenbosch, 7600, Western Cape',
        showDates: 'Thursday 23 to Sunday 26 September 2027',
        openingTimes: [
          { label: 'Thu 23', value: '16h00 to 19h00' },
          { label: 'Fri 24', value: null },
          { label: 'Sat 25', value: null },
          { label: 'Sun 26', value: null },
        ],
      },
      positions: [
        { bookingRef: 'TEST-0001', attendeeName: PERSON, ticketTypeTitle: 'Day Visitor', qrContentId: 'qr-1' },
        { bookingRef: 'TEST-0002', attendeeName: 'Second Person', ticketTypeTitle: 'Weekend Pass', qrContentId: 'qr-2' },
      ],
    }),
  },
  {
    name: 'VendorPaymentConfirmation',
    family: 'A',
    element: h(d(VendorPaymentConfirmation_m), {
      businessName: BIZ, boothSize: 2, amount: 1500, standOrderRef: 'VSO-TEST', showDetailsUrl: 'https://example.com/show',
    }),
  },
  {
    name: 'VendorApplicationConfirmation',
    family: 'B',
    element: h(d(VendorApplicationConfirmation_m), { businessName: BIZ, contactPersonName: PERSON }),
  },
  {
    name: 'VendorApprovalConfirmation',
    family: 'B',
    element: h(d(VendorApprovalConfirmation_m), { businessName: BIZ, contactPersonName: PERSON }),
  },
  {
    // the registration-link branch (renders the registration code); the plain fixture above is the booth-number branch
    name: 'VendorApprovalConfirmationWithCode',
    file: 'VendorApprovalConfirmation',
    family: 'B',
    element: h(d(VendorApprovalConfirmation_m), {
      businessName: BIZ, contactPersonName: PERSON, registrationLink: 'https://example.com/register', registrationCode: '4217',
    }),
  },
  {
    name: 'VendorRegistrationConfirmation',
    family: 'B',
    element: h(d(VendorRegistrationConfirmation_m), {
      businessName: BIZ, contactPersonName: PERSON, photoUploadUrl: 'https://example.com/photos',
    }),
  },
  {
    name: 'VendorStandPaymentReady',
    family: 'B',
    element: h(d(VendorStandPaymentReady_m), { businessName: BIZ, contactPersonName: PERSON, paymentUrl: 'https://example.com/pay' }),
  },
  {
    name: 'SupporterRegistrationConfirmation',
    family: 'B',
    element: h(d(SupporterRegistrationConfirmation_m), { firstName: 'Test', confirmUrl: 'https://example.com/confirm' }),
  },
  {
    name: 'VendorApplicationAdminNotice',
    family: 'C',
    element: h(d(VendorApplicationAdminNotice_m), {
      businessName: BIZ, contactPersonName: PERSON, applicationId: 'app-test', reviewUrl: 'https://example.com/admin',
    }),
  },
  {
    name: 'VendorSubmissionAdminNotice',
    family: 'C',
    element: h(d(VendorSubmissionAdminNotice_m), {
      businessName: BIZ, contactPersonName: PERSON, vendorSubmissionId: 'sub-test', reviewUrl: 'https://example.com/admin',
    }),
  },
  {
    name: 'VendorPaymentAdminNotice',
    family: 'C',
    element: h(d(VendorPaymentAdminNotice_m), {
      businessName: BIZ, contactPersonName: PERSON, standOrderRef: 'VSO-TEST', reviewUrl: 'https://example.com/admin',
    }),
  },
  {
    name: 'ReconciliationAlert',
    family: 'C',
    element: h(d(ReconciliationAlert_m), {
      orders: [{ orderId: 'ord-test', buyerName: PERSON, buyerEmail: 'test@example.com', amount: 300, m_payment_id: null }],
    }),
  },
  { name: 'ContactConfirmation', family: 'D', element: h(d(ContactConfirmation_m), { name: PERSON, subject: 'Test enquiry' }) },
];

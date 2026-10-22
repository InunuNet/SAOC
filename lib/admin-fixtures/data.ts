// Static fixture data for the flag-gated render-check route (app/admin-fixtures). Presentation
// only: nothing here is read from, or written to, a real collection. Builders take `now` so the
// "freshly submitted application" is always newest.
import type { DashboardData } from '@/lib/admin-dashboard';
import type { TicketRow } from '@/components/admin/TicketsTable';
import type {
  VendorApplication,
  VendorApplicationCategory,
  VendorStandOrderStatus,
  VendorSubmission,
} from '@/types/index';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const FIXTURE_FRESH_APPLICATION = 'Fresh Fixture Nursery';
export const FIXTURE_PENDING_COUNT = 4;

const TICKET_TYPES = [
  'Early-Bird Exhibition',
  'Day Visitor',
  'Early-Bird Weekend Pass',
  'Weekend Pass',
  'VIP',
] as const;
const TICKET_STATUSES = ['paid', 'checked-in', 'reserved', 'cancelled'] as const;
const TICKET_FIXTURE_COUNT = 40;
const FIRST_NAMES = ['Thandi', 'Pieter', 'Naledi', 'Johan', 'Ayesha', 'Sipho', 'Marié', 'Kagiso'];
const LAST_NAMES = ['Nkosi', 'van der Merwe', 'Dlamini', 'Botha', 'Patel', 'Mokoena', 'Jacobs', 'Naidoo'];

export function fixtureTickets(now: Date): TicketRow[] {
  return Array.from({ length: TICKET_FIXTURE_COUNT }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    return {
      id: `fixture-ticket-${i}`,
      bookingRef: `SAOC-${String(7400 + i)}`,
      attendeeName: i === 2 ? 'Bartholomew Wolfeschlegelsteinhausen-Montgomery' : `${first} ${last}`,
      attendeeEmail: `${first}.${last}.${i}@example.org`.toLowerCase().replace(/\s/g, ''),
      ticketType: TICKET_TYPES[i % TICKET_TYPES.length],
      status: TICKET_STATUSES[i % TICKET_STATUSES.length],
      purchasedAt: new Date(now.getTime() - i * 5 * HOUR_MS).toISOString(),
    };
  });
}

const CATEGORY_SETS: VendorApplicationCategory[][] = [
  ['orchids'],
  ['orchids', 'orchid-growing-supplies'],
  ['succulents', 'indoor-plants'],
  ['books-publications'],
  ['art', 'ceramics'],
  ['fertilisers-growing-media'],
];

// Newest first, as the server orders them. 8 rows, 4 pending, the first one just submitted.
export function fixtureApplications(now: Date): VendorApplication[] {
  const specs: { name: string; status: VendorApplication['status']; ageHours: number }[] = [
    { name: FIXTURE_FRESH_APPLICATION, status: 'pending', ageHours: 0 },
    {
      name: 'The Extraordinarily Long-Named Cape Peninsula Orchid and Succulent Growers Collective (Pty) Ltd',
      status: 'pending',
      ageHours: 30,
    },
    { name: 'Kloof Street Ceramics', status: 'approved', ageHours: 52 },
    { name: 'Hex River Orchids', status: 'pending', ageHours: 76 },
    { name: 'Garden Route Books', status: 'declined', ageHours: 100 },
    { name: 'Boland Succulent Studio', status: 'approved', ageHours: 130 },
    { name: 'Overberg Growing Media', status: 'pending', ageHours: 170 },
    { name: 'Franschhoek Botanical Art', status: 'approved', ageHours: 220 },
  ];
  return specs.map((spec, i) => ({
    id: `fixture-application-${i}`,
    businessName: spec.name,
    contactPersonName: `Contact Person ${i + 1}`,
    contactEmail: `contact${i + 1}@example.org`,
    contactCellPhone: '082 000 0000',
    vendorCategory: CATEGORY_SETS[i % CATEGORY_SETS.length],
    indicativeBoothCount: (i % 3) + 1,
    status: spec.status,
    submittedAt: new Date(now.getTime() - spec.ageHours * HOUR_MS),
    registrationCodeId: spec.status === 'approved' ? `Fixture-${4000 + i}` : null,
  }));
}

const VENDOR_STATUSES: VendorSubmission['status'][] = ['submitted', 'under-review', 'approved', 'rejected'];
const VENDOR_FIXTURE_COUNT = 12;

export function fixtureVendors(now: Date): VendorSubmission[] {
  return Array.from({ length: VENDOR_FIXTURE_COUNT }, (_, i) => ({
    id: `fixture-vendor-${i}`,
    businessName: i === 1 ? 'The Extraordinarily Long-Named Cape Peninsula Orchid Growers Collective' : `Fixture Vendor ${i + 1}`,
    contactPersonName: `Vendor Contact ${i + 1}`,
    contactCellPhone: '083 000 0000',
    contactEmail: `vendor${i + 1}@example.org`,
    physicalAddress: '1 Fixture Road, Stellenbosch',
    emergencyContactName: 'Emergency Contact',
    emergencyContactCellPhone: '084 000 0000',
    vendorCategory: CATEGORY_SETS[i % CATEGORY_SETS.length],
    productDescription: 'Fixture products.',
    powerRequired: false,
    termsAccepted: true,
    status: VENDOR_STATUSES[i % VENDOR_STATUSES.length],
    submittedAt: new Date(now.getTime() - i * DAY_MS),
    phytosanitaryPermitNumber: i % 2 === 0 ? `PHY-${1000 + i}` : undefined,
    boothSize: 'single',
    productPhoto1Path: 'fixture/1.jpg',
  }));
}

export function fixtureStandPayments(): Record<string, VendorStandOrderStatus> {
  return {
    'fixture-vendor-2': 'paid',
    'fixture-vendor-6': 'pending',
    'fixture-vendor-10': 'failed',
  };
}

export function fixtureDashboard(now: Date): DashboardData {
  const pending = fixtureApplications(now)
    .filter((app) => app.status === 'pending')
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(0, 5)
    .map((app) => ({ id: app.id, businessName: app.businessName, submittedAt: app.submittedAt }));
  return {
    ticketsSold: 128,
    orders: 87,
    pendingApplications: FIXTURE_PENDING_COUNT,
    vendorsApproved: 3,
    newsletterSubscribers: null,
    needsAttention: pending,
    generatedAt: now,
  };
}

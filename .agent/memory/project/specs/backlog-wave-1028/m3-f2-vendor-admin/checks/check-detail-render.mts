// F2b: render VendorSubmissionDetail for a pre-M2 doc, a minimal doc and an M2 doc.
// Contract: export function VendorSubmissionDetail({ submission, standOrderStatus, application }),
// a synchronous server component. application: VendorApplication | null.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VendorSubmissionDetail } from '../../../../../../../components/admin/VendorSubmissionDetail.tsx';

const SECTIONS = [
  'Business', 'Contact', 'Emergency contact', 'Products and permits', 'Food', 'Booth',
  'Electrical and water', 'Gas and heat', 'Staff and vehicles', 'Storage', 'Waste',
  'Marketing and uploads', 'Insurance', 'Payment', 'Declaration and terms', 'Original application',
];
const BAD = ['undefined', 'null', '[object Object]', 'NaN', 'Invalid Date', 'no-preference', 'standard-in-row', 'end-of-row'];
const failures: string[] = [];

function render(label: string, submission: Record<string, unknown>, standOrderStatus: string | null, application: unknown): string {
  try {
    // The cast is deliberate: the point of this check is hostile, partial documents.
    const el = React.createElement(VendorSubmissionDetail as unknown as React.ComponentType<Record<string, unknown>>, { submission, standOrderStatus, application });
    return renderToStaticMarkup(el);
  } catch (error) {
    failures.push(`${label}: threw ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

function assertClean(label: string, html: string) {
  if (!html) return;
  const text = html.replace(/<[^>]+>/g, ' ');
  for (const s of SECTIONS) if (!text.includes(s)) failures.push(`${label}: missing section heading "${s}"`);
  for (const b of BAD) if (text.includes(b)) failures.push(`${label}: rendered forbidden text "${b}"`);
}

const submittedAt = new Date('2026-09-01T10:00:00Z');

// 1. pre-M2 shape: deprecated fields only, M2 fields absent, hostile array shapes
const preM2 = {
  id: 'pre', businessName: 'Old Orchids', contactPersonName: 'A B', contactEmail: 'a@b.co', contactCellPhone: '0821234567',
  physicalAddress: '1 Road', emergencyContactName: 'C D', emergencyContactCellPhone: '0827654321',
  vendorCategory: ['plants'], productDescription: 'Plants', powerRequired: true, termsAccepted: true,
  status: 'submitted', submittedAt,
  boothCount: 2, boothType: 'no-preference', staffPerDay: 3, vehicleRegistrations: 'CA 123', electricalLoad: '2kW',
  electricalEquipmentList: 'kettle', gasEquipmentType: 'braai', hasPublicLiabilityInsurance: true, socialMediaHandle: '@old',
};
const preHtml = render('pre-M2', preM2, null, null);
assertClean('pre-M2', preHtml);
for (const needle of ['Old Orchids', 'CA 123', 'kettle', '@old', '(legacy)', 'Not started']) {
  if (preHtml && !preHtml.includes(needle)) failures.push(`pre-M2: expected to show "${needle}"`);
}
if (preHtml && !preHtml.includes('No preference')) failures.push('pre-M2: boothType no-preference must render the label "No preference"');

// 2. minimal doc: only the required keys, everything else absent; hostile table shapes
const minimal = {
  id: 'min', businessName: 'Bare', contactPersonName: 'x', contactEmail: 'x@y.z', contactCellPhone: '1', physicalAddress: 'p',
  emergencyContactName: 'e', emergencyContactCellPhone: '2', vendorCategory: [], productDescription: 'd', powerRequired: false,
  termsAccepted: false, status: 'approved', submittedAt,
  electricalEquipmentEntries: [null, 'x', 7, {}], gasEquipmentEntries: 'not-an-array', wasteTypes: null, foodVendorCertifications: {},
};
assertClean('minimal', render('minimal', minimal, null, null));

// 3. M2-ish doc with a matched application and a paid stand order, Dates everywhere
const m2 = {
  ...minimal, id: 'm2', businessName: 'New Orchids', boothSize: '3x3', boothType: 'corner', termsAccepted: true, signatureFullName: 'Jo Vendor',
  logoPath: 'vendors/m2/logo.png', logoUploadedAt: submittedAt, productPhoto1Path: 'vendors/m2/p1.jpg', productPhoto1UploadedAt: submittedAt,
  reviewedAt: submittedAt, paymentConfirmedAt: submittedAt, paymentReceived: true,
  electricalEquipmentEntries: [{ description: 'Fridge', quantity: 1, wattage: 200 }],
};
const app = { id: 'app', businessName: 'New Orchids', contactEmail: 'x@y.z', contactPersonName: 'x', contactCellPhone: '1', vendorCategory: ['plants'], indicativeBoothCount: 2, status: 'approved', submittedAt, reviewedAt: submittedAt };
const m2Html = render('M2', m2, 'paid', app);
assertClean('M2', m2Html);
for (const needle of ['Jo Vendor', 'Corner', 'Paid', 'logo.png']) {
  if (m2Html && !m2Html.includes(needle)) failures.push(`M2: expected to show "${needle}"`);
}
if (m2Html.includes('vendors/m2/logo.png')) failures.push('M2: upload paths must show the base name only');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS');

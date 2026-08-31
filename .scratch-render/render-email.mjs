import React from 'react';
import { render } from '@react-email/render';
import VendorApprovalConfirmation from '/Users/vetus/ai/SAOC/emails/VendorApprovalConfirmation.tsx';

const base = { businessName: 'Cape Orchid Traders', contactPersonName: 'Jane Vendor' };

const appEmail = await render(
  React.createElement(VendorApprovalConfirmation, {
    ...base,
    registrationLink: 'https://saoc.co.za/national-show/vendors/register?token=abc',
  }),
  { plainText: true },
);
console.log('===== APPLICATION-APPROVAL EMAIL (registrationLink present) =====');
console.log(appEmail);

const full = await render(
  React.createElement(VendorApprovalConfirmation, {
    ...base, boothNumber: 'A12', boothType: 'standard-in-row', staffPerDay: 3,
    powerRequired: true, waterRequired: false,
    loadInSlot: '2027-09-15T06:00', loadOutSlot: '2027-09-19T18:00',
  }),
  { plainText: true },
);
console.log('===== EXISTING FULL-REGISTRATION EMAIL (no registrationLink) =====');
console.log(full);

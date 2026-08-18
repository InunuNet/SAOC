// F8 (vendor-registration) — compiler-driven (not source-grep) proof of the exported shapes
// lib/vendor-approval-confirmation.ts and emails/VendorApprovalConfirmation.tsx must add. Run
// via its own scoped tsconfig (see that file's header) because the root tsconfig.json excludes
// `contracts/` from `pnpm type-check`.
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-f8-approval-email/tsconfig.typecheck.json

import type { ReactElement } from 'react';
import {
  sendVendorApprovalConfirmationEmail,
  type VendorApprovalConfirmationInput,
  type VendorApprovalConfirmationMailer,
  type SendVendorApprovalConfirmationDeps,
} from '../../../../lib/vendor-approval-confirmation';
import {
  formatBoothNumber,
  formatOptionalField,
  BOOTH_NUMBER_PENDING_LABEL,
  LOGISTICS_NOT_SPECIFIED_LABEL,
} from '../../../../emails/VendorApprovalConfirmation';

// (1) A fully-typed input with every optional field present.
const fullInput: VendorApprovalConfirmationInput = {
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  boothNumber: 'A12',
  boothType: 'standard',
  staffPerDay: 3,
  powerRequired: true,
  waterRequired: true,
  loadInSlot: '2027-03-10T06:00:00.000Z',
  loadOutSlot: '2027-03-14T18:00:00.000Z',
};

// (2) The same input with every optional field omitted -- still compiles.
const minimalInput: VendorApprovalConfirmationInput = {
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  powerRequired: false,
};

// (3) A fixture mailer satisfies the deliberately-narrow mailer interface.
const fixtureMailer: VendorApprovalConfirmationMailer = {
  send: async (_args: { to: string; subject: string; react: ReactElement }) => {},
};

const deps: SendVendorApprovalConfirmationDeps = { mailer: fixtureMailer };

async function exercise(): Promise<void> {
  await sendVendorApprovalConfirmationEmail(fullInput, deps);
  await sendVendorApprovalConfirmationEmail(minimalInput);
}
void exercise;

// (4) formatBoothNumber/formatOptionalField's parameter and return types.
const boothLabel: string = formatBoothNumber('A12');
const boothLabelMissing: string = formatBoothNumber(null);
const boothLabelUndefined: string = formatBoothNumber(undefined);
void boothLabel;
void boothLabelMissing;
void boothLabelUndefined;

const stringField: string = formatOptionalField('slot');
const numberField: string = formatOptionalField(3);
const boolField: string = formatOptionalField(true);
const missingField: string = formatOptionalField(null);
const undefinedField: string = formatOptionalField(undefined);
void stringField;
void numberField;
void boolField;
void missingField;
void undefinedField;

// (5) The two named label constants type as string.
const pendingLabel: string = BOOTH_NUMBER_PENDING_LABEL;
const notSpecifiedLabel: string = LOGISTICS_NOT_SPECIFIED_LABEL;
void pendingLabel;
void notSpecifiedLabel;

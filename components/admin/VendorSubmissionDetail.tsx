import type { ReactNode } from 'react';

import type { VendorApplication, VendorStandOrderStatus, VendorSubmission } from '@/types/index';
import { formatAdminDateTime } from '@/lib/admin-format';
import { getBoothTypeLabel } from '@/lib/vendor-booth-type-labels';
import { vendorCategoryLabels } from '@/lib/vendor-category-labels';
import { STAND_PAYMENT_LABELS } from '@/lib/vendor-stand-payment-labels';
import { CARD_CLASS } from './tokens';

// Read-only view of one full vendor registration. Every field is read as optional and
// untrusted: pre-M2 documents lack most M2 fields and carry deprecated shapes, and a table
// field may hold anything. Nothing here throws on undefined, null or a wrongly typed value.

const NOT_PROVIDED = '—';
const REQUIRED_PRODUCT_PHOTO_COUNT = 3;

interface VendorSubmissionDetailProps {
  submission: VendorSubmission;
  /** Status of the vendorStandOrders doc with the same id; null when none exists. */
  standOrderStatus: VendorStandOrderStatus | null;
  /** Best-effort match (business name and email); null when zero or several rows match. */
  application: VendorApplication | null;
}

type DetailRow = { label: string; value: ReactNode };

// Labels as the registration form shows them (components/vendors/*Fieldset.tsx).
const BOOTH_SIZE_LABELS: Record<string, string> = {
  single: '1 Single Booth — 2.5m x 3m',
  double: '2 Booths (Double) — 5m x 3m',
  triple: '3 Booths (Triple) — 7m x 3m',
};
const ENTITY_TYPE_LABELS: Record<string, string> = {
  company: 'Company',
  'close-corporation': 'Close Corporation',
  'sole-proprietor': 'Sole Proprietor',
  partnership: 'Partnership',
  individual: 'Individual',
  other: 'Other',
};
const WASTE_TYPE_LABELS: Record<string, string> = {
  general: 'General waste',
  'cardboard-packaging': 'Cardboard / packaging',
  'plant-material': 'Plant material',
  'food-waste': 'Food Waste',
  wastewater: 'Wastewater',
  other: 'Other',
};
const FOOD_CERTIFICATION_LABELS: Record<string, string> = {
  'mobile-coa': 'Mobile certificate of acceptability',
  'perishable-foodstuff-licence': 'Perishable Foodstuff Licence',
  'hawker-informal-trading-permit': 'Hawker/Informal Trading Permit',
  'mobile-gas-compliance-certificate': 'Mobile gas certificate of compliance',
  'fire-safety-compliance': 'Fire safety compliance',
  'vehicle-fitness-certificate': 'Certificate of fitness for vehicles',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  eft: 'EFT',
  'not-applicable': 'Not applicable',
};
const VEHICLE_REGISTRATION_FIELDS: ReadonlyArray<readonly [string, keyof VendorSubmission]> = [
  ['Car registration', 'carRegistrationNumber'],
  ['SUV / bakkie registration', 'suvBakkieRegistrationNumber'],
  ['Panel van registration', 'panelVanRegistrationNumber'],
  ['Delivery van registration', 'deliveryVanRegistrationNumber'],
  ['Truck registration', 'truckRegistrationNumber'],
  ['Trailer registration', 'trailerRegistrationNumber'],
  ['Other vehicle registration', 'otherVehicleRegistrationNumber'],
];
const SOCIAL_FIELDS: ReadonlyArray<readonly [string, keyof VendorSubmission]> = [
  ['Facebook', 'facebookHandle'],
  ['Instagram', 'instagramHandle'],
  ['TikTok', 'tiktokHandle'],
  ['YouTube', 'youtubeHandle'],
  ['Other social media', 'otherSocialMediaHandle'],
];

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function yesNo(value: unknown): string | null {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return null;
}

function humanise(slug: string): string {
  const spaced = slug.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labelled(value: unknown, labels: Record<string, string>): string | null {
  const slug = text(value);
  return slug === null ? null : (labels[slug] ?? humanise(slug));
}

function labelledList(value: unknown, labels: Record<string, string>): string | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((entry) => labelled(entry, labels))
    .filter((entry): entry is string => entry !== null);
  return items.length > 0 ? items.join(', ') : null;
}

/** Known category slugs use the form labels; a retired slug (pre-M2) is humanised, never shown raw. */
function categoryList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((entry) => text(entry))
    .filter((slug): slug is string => slug !== null)
    .map((slug) => {
      const label = vendorCategoryLabels([slug]);
      return label === slug ? humanise(slug) : label;
    });
  return items.length > 0 ? items.join(', ') : null;
}

function when(value: unknown): string | null {
  if (value instanceof Date || typeof value === 'string') {
    const formatted = formatAdminDateTime(value);
    return formatted === NOT_PROVIDED ? null : formatted;
  }
  return null;
}

/** Upload paths are shown as the file's base name only; never a full storage path. */
function baseName(path: unknown): string | null {
  const full = text(path);
  if (full === null) return null;
  return full.split('/').filter(Boolean).pop() ?? null;
}

function upload(path: unknown, uploadedAt: unknown): string | null {
  const name = baseName(path);
  if (name === null) return null;
  const at = when(uploadedAt);
  return at === null ? name : `${name} (uploaded ${at})`;
}

function joined(parts: Array<string | null>, separator = ' · '): string | null {
  const present = parts.filter((part): part is string => part !== null);
  return present.length > 0 ? present.join(separator) : null;
}

function withOther(main: string | null, other: unknown): string | null {
  const extra = text(other);
  if (extra === null) return main;
  return main === null ? extra : `${main} (${extra})`;
}

function row(label: string, value: ReactNode | null | undefined): DetailRow {
  return { label, value: value ?? null };
}

/** A row that exists only when the (legacy) field is present on the document. */
function legacyRow(label: string, value: string | null): DetailRow[] {
  return value === null ? [] : [row(`${label} (legacy)`, value)];
}

/** Repeating-table rows: non-object rows are skipped, absent cells render as the dash. */
function tableRows(entries: unknown, columns: ReadonlyArray<readonly [string, string]>): ReactNode {
  if (!Array.isArray(entries)) return null;
  const objects = entries.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
  if (objects.length === 0) return null;
  return (
    <ul className="space-y-1">
      {objects.map((entry, index) => (
        <li key={index}>
          {columns.map(([label, key]) => `${label}: ${text(entry[key]) ?? NOT_PROVIDED}`).join(' · ')}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, note, rows }: { title: string; note?: string; rows: DetailRow[] }) {
  return (
    <section className={CARD_CLASS}>
      <h2 className="font-serif text-[22px] font-semibold text-ink">{title}</h2>
      {note ? <p className="mt-1 font-sans text-[13px] text-muted">{note}</p> : null}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule-soft pt-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        {rows.map((item) => (
          <div key={item.label} className="contents">
            <dt className="font-sans text-[13px] text-muted">{item.label}</dt>
            <dd className="min-w-0 break-words font-sans text-[14px] text-ink">
              {item.value ?? <span className="text-muted">{NOT_PROVIDED}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function businessRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Business name', text(s.businessName)),
    row(
      'Trading name',
      s.tradingNameSameAsBusiness === true ? 'Same as business name' : text(s.tradingName),
    ),
    row(
      'Business entity type',
      withOther(labelled(s.businessEntityType, ENTITY_TYPE_LABELS), s.businessEntityTypeOther),
    ),
    row('CIPC number', text(s.cipcNumber)),
    row('VAT registered', yesNo(s.vatRegistered)),
    row('VAT number', text(s.vatNumber)),
    row('Country of business registration', text(s.countryOfBusinessRegistration)),
    row('Physical address', text(s.physicalAddress)),
    row(
      'Postal address',
      s.postalAddressSameAsPhysical === true ? 'Same as physical address' : text(s.postalAddress),
    ),
    row('Website', text(s.website)),
    ...SOCIAL_FIELDS.map(([label, key]) => row(label, text(s[key]))),
    ...legacyRow('Social media handle', text(s.socialMediaHandle)),
    row('Status', labelled(s.status, {})),
    row('Submitted', when(s.submittedAt)),
    row('Reviewed by', text(s.reviewedBy)),
    row('Reviewed', when(s.reviewedAt)),
  ];
}

function contactRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Contact person', text(s.contactPersonName)),
    row('Position', text(s.contactPosition)),
    row('Email', text(s.contactEmail)),
    row('Cell phone', text(s.contactCellPhone)),
    row('Alternative contact number', text(s.alternativeContactNumber)),
    row('Accounts contact name', text(s.accountsContactName)),
    row('Accounts contact email', text(s.accountsContactEmail)),
  ];
}

function emergencyRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Name', text(s.emergencyContactName)),
    row('Relationship', text(s.emergencyContactRelationship)),
    row('Cell phone', text(s.emergencyContactCellPhone)),
  ];
}

function productRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Category', withOther(categoryList(s.vendorCategory), s.vendorCategoryOther)),
    row('Product description', text(s.productDescription)),
    row('Bio', text(s.bio)),
    row('Sells live plants', yesNo(s.sellsLivePlants)),
    row(
      'Live plant types',
      withOther(labelledList(s.livePlantTypes, {}), s.livePlantTypesOther),
    ),
    row('Plants imported for the event', yesNo(s.plantsImportedForEvent)),
    row('Import country of origin', text(s.importCountryOfOrigin)),
    row('CITES listed species', yesNo(s.citesListedSpecies)),
    row('Phytosanitary / import permit', text(s.phytosanitaryPermitNumber)),
    row('CITES permit', text(s.citesPermitNumber)),
    row(
      'Note',
      <span className="text-[12px] text-muted">
        Permit and certificate numbers are recorded as submitted and have not been verified by SAOC.
      </span>,
    ),
  ];
}

function foodRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Certifications', labelledList(s.foodVendorCertifications, FOOD_CERTIFICATION_LABELS)),
    row('Food-handling certificate', text(s.foodHandlingCertificateNumber)),
    row('Food items', text(s.foodItemList)),
    row('Health and trading documentation', text(s.foodHealthTradingDocumentation)),
    row('Food prepared on site', yesNo(s.foodPreparationOnSite)),
    row('Cooking on site', yesNo(s.foodCookingOnSite)),
  ];
}

function boothRows(s: VendorSubmission): DetailRow[] {
  const size = labelled(s.boothSize, BOOTH_SIZE_LABELS);
  return [
    size !== null
      ? row('Booth size', size)
      : row('Booth count (legacy)', text(s.boothCount)),
    row('Booth position', getBoothTypeLabel(text(s.boothType)) ?? labelled(s.boothType, {})),
    row('Tables', text(s.tableCount)),
    row('Chairs', text(s.chairCount)),
    row('Position request', text(s.boothPositionRequest)),
    row('Adjacent booth requested', yesNo(s.adjacentBoothRequested)),
    row('Adjacent vendor name', text(s.adjacentBoothVendorName)),
    row('Special display requirements', text(s.specialDisplayRequirements)),
    row('Booth number', text(s.boothNumber)),
  ];
}

function electricalRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Power required', yesNo(s.powerRequired)),
    row('Electrical outlets required', text(s.electricalOutletsRequired)),
    row(
      'Electrical equipment',
      tableRows(s.electricalEquipmentEntries, [
        ['Equipment', 'equipment'],
        ['Quantity', 'quantity'],
        ['Wattage', 'wattage'],
        ['Running time per day', 'runningTimePerDay'],
      ]),
    ),
    ...legacyRow('Electrical load', text(s.electricalLoad)),
    ...legacyRow('Electrical equipment list', text(s.electricalEquipmentList)),
    row('Equipment runs continuously', yesNo(s.electricalEquipmentContinuousOperation)),
    row('Continuous operation details', text(s.electricalEquipmentContinuousDetails)),
    row('Water required', yesNo(s.waterRequired)),
    row('Intended water use', text(s.waterIntendedUse)),
    row('Wastewater drainage required', yesNo(s.wastewaterDrainageRequired)),
    row('Wastewater drainage details', text(s.wastewaterDrainageDetails)),
  ];
}

function gasRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Gas or heat equipment used', yesNo(s.gasOrHeatEquipmentUsed)),
    row(
      'Gas equipment',
      tableRows(s.gasEquipmentEntries, [
        ['Equipment type', 'equipmentType'],
        ['Gas type', 'gasType'],
        ['Cylinder size', 'cylinderSize'],
        ['Cylinders', 'cylinderCount'],
      ]),
    ),
    ...legacyRow('Gas equipment type', text(s.gasEquipmentType)),
    ...legacyRow('Gas fuel type', text(s.gasFuelType)),
    ...legacyRow('Gas cylinder size', text(s.gasCylinderSize)),
    ...legacyRow('Gas cylinder count', text(s.gasCylinderCount)),
    row('Gas safety information', text(s.gasSafetyInformation)),
  ];
}

function staffRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Staff on setup day', text(s.staffCountSetupDay)),
    row('Staff on day 1', text(s.staffCountDay1)),
    row('Staff on day 2', text(s.staffCountDay2)),
    row('Staff on day 3', text(s.staffCountDay3)),
    row('Staff on breakdown day', text(s.staffCountBreakdownDay)),
    ...legacyRow('Staff per day', text(s.staffPerDay)),
    row('Exhibitor passes required', yesNo(s.exhibitorPassesRequired)),
    row('Exhibitor passes', text(s.exhibitorPassesCount)),
    row('Vehicle type', withOther(labelled(s.vehicleType, {}), s.vehicleTypeOther)),
    row('Vehicle height', text(s.vehicleHeight)),
    row('Vehicle length', text(s.vehicleLength)),
    row('Trailer attached', yesNo(s.trailerAttached)),
    ...VEHICLE_REGISTRATION_FIELDS.map(([label, key]) => row(label, text(s[key]))),
    row('Other vehicle description', text(s.otherVehicleDescription)),
    ...legacyRow('Vehicle registrations', text(s.vehicleRegistrations)),
    row('Load-in slot', text(s.loadInSlot)),
    row('Load-out slot', text(s.loadOutSlot)),
  ];
}

function uploadRows(s: VendorSubmission): DetailRow[] {
  const photoCount = [s.productPhoto1Path, s.productPhoto2Path, s.productPhoto3Path].filter(
    (path) => baseName(path) !== null,
  ).length;
  return [
    row('Marketing permission', labelled(s.marketingPermission, {})),
    row('Logo', upload(s.logoPath, s.logoUploadedAt)),
    row('Product photo 1', upload(s.productPhoto1Path, s.productPhoto1UploadedAt)),
    row('Product photo 2', upload(s.productPhoto2Path, s.productPhoto2UploadedAt)),
    row('Product photo 3', upload(s.productPhoto3Path, s.productPhoto3UploadedAt)),
    row('Product photos uploaded', `${photoCount}/${REQUIRED_PRODUCT_PHOTO_COUNT}`),
    row(
      'Public listing',
      text(s.listingDocumentId)
        ? (joined(['Published', when(s.listingPublishedAt)], ' ') ?? 'Published')
        : 'Not published',
    ),
  ];
}

function insuranceRows(s: VendorSubmission): DetailRow[] {
  return [
    ...legacyRow('Public liability insurance', yesNo(s.hasPublicLiabilityInsurance)),
    row('Public liability policy number', text(s.publicLiabilityInsurancePolicyNumber)),
    row('Product liability insurance', labelled(s.productLiabilityInsuranceStatus, {})),
    row('Product liability policy number', text(s.productLiabilityInsurancePolicyNumber)),
  ];
}

function paymentRows(s: VendorSubmission, standOrderStatus: VendorStandOrderStatus | null): DetailRow[] {
  const stand =
    standOrderStatus === null
      ? STAND_PAYMENT_LABELS['not-started']
      : (STAND_PAYMENT_LABELS[standOrderStatus] ?? humanise(String(standOrderStatus)));
  return [
    row('Stand payment (gateway)', stand),
    row('Payment methods accepted', labelledList(s.paymentMethodsAccepted, PAYMENT_METHOD_LABELS)),
    row('Payment reference', text(s.paymentReference)),
    row('Proof of payment', upload(s.proofOfPaymentPath, s.proofOfPaymentUploadedAt)),
    row(
      'Office payment',
      typeof s.paymentReceived === 'boolean' ? (s.paymentReceived ? 'Received' : 'Not received') : null,
    ),
    row('Confirmed by', text(s.paymentConfirmedBy)),
    row('Confirmed', when(s.paymentConfirmedAt)),
  ];
}

function declarationRows(s: VendorSubmission): DetailRow[] {
  return [
    row('Terms accepted', yesNo(s.termsAccepted)),
    row('Signature (full name)', text(s.signatureFullName)),
    row('Submitted', when(s.submittedAt)),
  ];
}

function applicationRows(application: VendorApplication): DetailRow[] {
  return [
    row('Indicative number of stands', text(application.indicativeBoothCount)),
    row('Category', categoryList(application.vendorCategory)),
    row('Status', labelled(application.status, {})),
    row('Submitted', when(application.submittedAt)),
    row('Reviewed by', text(application.reviewedBy)),
    row('Reviewed', when(application.reviewedAt)),
  ];
}

export function VendorSubmissionDetail({
  submission,
  standOrderStatus,
  application,
}: VendorSubmissionDetailProps) {
  return (
    <div className="space-y-6">
      <Section title="Business" rows={businessRows(submission)} />
      <Section title="Contact" rows={contactRows(submission)} />
      <Section title="Emergency contact" rows={emergencyRows(submission)} />
      <Section title="Products and permits" rows={productRows(submission)} />
      <Section title="Food" rows={foodRows(submission)} />
      <Section title="Booth" rows={boothRows(submission)} />
      <Section title="Electrical and water" rows={electricalRows(submission)} />
      <Section title="Gas and heat" rows={gasRows(submission)} />
      <Section title="Staff and vehicles" rows={staffRows(submission)} />
      <Section
        title="Storage"
        rows={[row('Storage risk acknowledged', yesNo(submission.storageRiskAcknowledged))]}
      />
      <Section
        title="Waste"
        rows={[
          row('Waste types', withOther(labelledList(submission.wasteTypes, WASTE_TYPE_LABELS), submission.wasteTypesOther)),
          row('Special waste requirements', text(submission.specialWasteRequirements)),
        ]}
      />
      <Section title="Marketing and uploads" rows={uploadRows(submission)} />
      <Section title="Insurance" rows={insuranceRows(submission)} />
      <Section title="Payment" rows={paymentRows(submission, standOrderStatus)} />
      <Section title="Declaration and terms" rows={declarationRows(submission)} />
      {application ? (
        <Section
          title="Original application"
          note="Matched by business name and email."
          rows={applicationRows(application)}
        />
      ) : (
        <section className={CARD_CLASS}>
          <h2 className="font-serif text-[22px] font-semibold text-ink">Original application</h2>
          <p className="mt-1 font-sans text-[13px] text-muted">Matched by business name and email.</p>
          <p className="mt-4 font-sans text-[14px] text-muted">No single matching application found.</p>
        </section>
      )}
    </div>
  );
}

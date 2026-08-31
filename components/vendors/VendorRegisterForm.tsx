'use client';

import { useEffect, useRef, useState } from 'react';

import {
  buildVendorRegistrationPayload,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import {
  describeVendorRegistrationResponse,
  type VendorRegisterResponseDescription,
} from '@/lib/vendor-register-response';
import { validateVendorRegisterFormClientSide } from '@/lib/vendor-register-form-validation';
import { VendorContactFieldset } from './VendorContactFieldset';
import { VendorEmergencyContactFieldset } from './VendorEmergencyContactFieldset';
import { VendorCategoryFieldset } from './VendorCategoryFieldset';
import { VendorBoothFieldset } from './VendorBoothFieldset';
import { VendorMarketingFieldset } from './VendorMarketingFieldset';
import { VendorPaymentFieldset } from './VendorPaymentFieldset';
import { VendorRegisterStatusBanner } from './VendorRegisterStatusBanner';
import { VendorRegisterSuccess } from './VendorRegisterSuccess';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const INITIAL_STATE: VendorRegisterFormState = {
  businessName: '',
  tradingName: '',
  tradingNameSameAsBusiness: false,
  businessEntityType: '',
  businessEntityTypeOther: '',
  contactPersonName: '',
  contactPosition: '',
  contactCellPhone: '',
  alternativeContactNumber: '',
  contactEmail: '',
  accountsContactName: '',
  accountsContactEmail: '',
  physicalAddress: '',
  postalAddressSameAsPhysical: false,
  postalAddress: '',
  cipcNumber: '',
  vatRegistered: '',
  vatNumber: '',
  countryOfBusinessRegistration: '',
  website: '',
  socialMediaHandle: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactCellPhone: '',
  vendorCategory: [],
  vendorCategoryOther: '',
  productDescription: '',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  sellsLivePlants: '',
  livePlantTypes: [],
  livePlantTypesOther: '',
  plantsImportedForEvent: '',
  importCountryOfOrigin: '',
  citesListedSpecies: '',
  foodHealthTradingDocumentation: '',
  boothCount: '',
  boothType: '',
  boothPositionRequest: '',
  adjacentBoothRequested: '',
  adjacentBoothVendorName: '',
  specialDisplayRequirements: '',
  tableCount: '',
  chairCount: '',
  powerRequired: '',
  electricalLoad: '',
  electricalOutletsRequired: '',
  electricalEquipmentList: '',
  electricalEquipmentContinuousOperation: '',
  electricalEquipmentContinuousDetails: '',
  waterRequired: '',
  waterIntendedUse: '',
  wastewaterDrainageRequired: '',
  wastewaterDrainageDetails: '',
  staffPerDay: '',
  vehicleRegistrations: '',
  loadInSlot: '',
  loadOutSlot: '',
  bio: '',
  paymentMethodsAccepted: [],
  paymentReference: '',
  termsAccepted: false,
};

// F7 (vendor-gated-registration-flow) -- token is caller-supplied (from the page's already-
// verified `?token=` search param), included verbatim in the POST body alongside the existing
// buildVendorRegistrationPayload() output. Never merged into buildVendorRegistrationPayload()
// itself -- that function's return shape (and every golden/check that pins it) stays
// untouched; the token is gate metadata, not a VendorSubmission field.
interface VendorRegisterFormProps {
  token: string;
}

export function VendorRegisterForm({ token }: VendorRegisterFormProps) {
  const [state, setState] = useState<VendorRegisterFormState>(INITIAL_STATE);
  const [hp, setHp] = useState(''); // honeypot -- never sent to the API
  const [status, setStatus] = useState<Status>('idle');
  const [descriptor, setDescriptor] = useState<VendorRegisterResponseDescription | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // The form runs to 30+ fields -- long enough that a banner rendered above the fieldsets is
  // off-screen for anyone submitting from the bottom. Without this, a real validation error
  // (or network failure) reads as "the button did nothing."
  useEffect(() => {
    if (descriptor && descriptor.kind !== 'success') {
      bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      bannerRef.current?.focus({ preventScroll: true });
    }
  }, [descriptor]);

  function handleFieldChange(key: keyof VendorRegisterFormState, value: string | string[] | boolean) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    if (hp.trim() !== '') {
      setStatus('error');
      setDescriptor({ kind: 'error', message: 'Something went wrong. Please try again.' });
      return;
    }

    const clientErrors = validateVendorRegisterFormClientSide(state);
    if (clientErrors.length > 0) {
      setStatus('error');
      setDescriptor({
        kind: 'validation-error',
        message: 'Please check the highlighted fields.',
        fieldErrors: clientErrors,
      });
      return;
    }

    setStatus('submitting');
    setDescriptor(null);

    try {
      const res = await fetch('/api/vendors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(buildVendorRegistrationPayload(state) as Record<string, unknown>),
          token,
        }),
      });
      const body = await res.json().catch(() => undefined);
      const result = describeVendorRegistrationResponse(res.status, body);
      setDescriptor(result);
      setStatus(result.kind === 'success' ? 'success' : 'error');
    } catch {
      setDescriptor(describeVendorRegistrationResponse(0, undefined));
      setStatus('error');
    }
  }

  if (status === 'success' && descriptor?.kind === 'success') {
    return <VendorRegisterSuccess descriptor={descriptor} />;
  }

  const disabled = status === 'submitting';

  return (
    <form onSubmit={handleSubmit} className="space-y-10 sm:space-y-12" noValidate>
      {descriptor ? (
        <div ref={bannerRef} tabIndex={-1}>
          <VendorRegisterStatusBanner descriptor={descriptor} />
        </div>
      ) : null}

      <VendorContactFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />
      <VendorEmergencyContactFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />
      <VendorCategoryFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />
      <VendorBoothFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />
      <VendorMarketingFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />
      <VendorPaymentFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />

      {/* Honeypot -- visually hidden, tab-unreachable, aria-hidden. Mirrors ContactForm.tsx. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory hover:bg-accent-soft transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
      >
        {status === 'submitting' ? 'Submitting…' : 'Submit registration'}
      </button>
    </form>
  );
}

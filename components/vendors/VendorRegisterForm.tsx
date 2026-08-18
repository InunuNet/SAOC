'use client';

import { useState } from 'react';

import {
  buildVendorRegistrationPayload,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import {
  describeVendorRegistrationResponse,
  type VendorRegisterResponseDescription,
} from '@/lib/vendor-register-response';
import { VendorContactFieldset } from './VendorContactFieldset';
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
  contactPersonName: '',
  contactCellPhone: '',
  contactEmail: '',
  physicalAddress: '',
  cipcNumber: '',
  vatNumber: '',
  website: '',
  socialMediaHandle: '',
  vendorCategory: [],
  productDescription: '',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  boothCount: '',
  boothType: '',
  tableCount: '',
  chairCount: '',
  powerRequired: '',
  electricalLoad: '',
  waterRequired: '',
  staffPerDay: '',
  vehicleRegistrations: '',
  loadInSlot: '',
  loadOutSlot: '',
  bio: '',
  paymentMethodsAccepted: [],
  paymentReference: '',
  termsAccepted: false,
};

export function VendorRegisterForm() {
  const [state, setState] = useState<VendorRegisterFormState>(INITIAL_STATE);
  const [hp, setHp] = useState(''); // honeypot -- never sent to the API
  const [status, setStatus] = useState<Status>('idle');
  const [descriptor, setDescriptor] = useState<VendorRegisterResponseDescription | null>(null);

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

    setStatus('submitting');
    setDescriptor(null);

    try {
      const res = await fetch('/api/vendors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVendorRegistrationPayload(state)),
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
      {descriptor ? <VendorRegisterStatusBanner descriptor={descriptor} /> : null}

      <VendorContactFieldset state={state} onFieldChange={handleFieldChange} disabled={disabled} />
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
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory hover:bg-accent-soft transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Submitting…' : 'Submit registration'}
      </button>
    </form>
  );
}

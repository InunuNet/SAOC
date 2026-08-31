'use client';

import { useState } from 'react';

import { VendorFormField } from './VendorFormField';
import { VendorCheckboxGroupField } from './VendorCheckboxGroupField';
import { VENDOR_APPLICATION_CATEGORIES } from '@/lib/vendor-applications';
import type { VendorApplicationCategory } from '@/types/index';

/**
 * F4 (vendor-gated-registration-flow) -- the short public application form. Collects exactly
 * the six fields the golden README specifies (businessName, tradingName, contactPersonName,
 * contactEmail, contactCellPhone, vendorCategory, indicativeBoothCount) and posts them to
 * POST /api/vendors/apply. Reuses VendorFormField/VendorCheckboxGroupField -- no new field
 * primitive. No terms acceptance here -- that belongs to the full registration + agreement,
 * reached only after committee approval via a single-use link (F7), not this application.
 *
 * Category labels are defined locally (VENDOR_APPLICATION_CATEGORIES only carries the
 * slug-cased values) in the exact document order recorded in the golden README's "The 14-item
 * Vendor Category & Products list."
 */
const CATEGORY_LABELS: Record<VendorApplicationCategory, string> = {
  orchids: 'Orchids',
  'cites-listed-plants': 'CITES listed plants',
  'indoor-plants': 'Indoor plants',
  succulents: 'Succulents',
  'rare-plants': 'Rare plants',
  'exotic-plants': 'Exotic plants',
  'indigenous-plants': 'Indigenous plants',
  'orchid-growing-supplies': 'Orchid growing products and supplies',
  'greenhouse-hardware-infrastructure': 'Greenhouse, hardware and infrastructure',
  'fertilisers-growing-media': 'Fertilisers, growing media, plant care products',
  'books-publications': 'Books, publications',
  art: 'Art',
  ceramics: 'Ceramics',
  'food-beverage-retailer': 'Food and beverage retailer',
};

const CATEGORY_OPTIONS = VENDOR_APPLICATION_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

interface VendorApplyFormState {
  businessName: string;
  tradingName: string;
  contactPersonName: string;
  contactEmail: string;
  contactCellPhone: string;
  vendorCategory: string[];
  indicativeBoothCount: string;
}

const INITIAL_STATE: VendorApplyFormState = {
  businessName: '',
  tradingName: '',
  contactPersonName: '',
  contactEmail: '',
  contactCellPhone: '',
  vendorCategory: [],
  indicativeBoothCount: '',
};

type Status = 'idle' | 'submitting' | 'success' | 'error';

function omitBlank(value: string): string | undefined {
  return value === '' ? undefined : value;
}

export function VendorApplyForm() {
  const [state, setState] = useState<VendorApplyFormState>(INITIAL_STATE);
  const [hp, setHp] = useState(''); // honeypot -- never sent to the API
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  function handleChange(key: keyof VendorApplyFormState, value: string | string[]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    if (hp.trim() !== '') {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
      setFieldErrors([]);
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);
    setFieldErrors([]);

    try {
      const res = await fetch('/api/vendors/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: state.businessName,
          tradingName: omitBlank(state.tradingName),
          contactPersonName: state.contactPersonName,
          contactEmail: state.contactEmail.trim(),
          contactCellPhone: state.contactCellPhone.trim(),
          vendorCategory: state.vendorCategory,
          indicativeBoothCount: state.indicativeBoothCount
            ? Number.parseInt(state.indicativeBoothCount, 10)
            : undefined,
        }),
      });
      const body = (await res.json().catch(() => undefined)) as
        | { success?: boolean; id?: string; error?: string; fieldErrors?: string[] }
        | undefined;

      if (res.ok && body?.success) {
        setStatus('success');
        return;
      }

      setStatus('error');
      setErrorMessage(body?.error ?? 'Failed to submit your application. Please try again.');
      setFieldErrors(body?.fieldErrors ?? []);
    } catch {
      setStatus('error');
      setErrorMessage('Failed to reach the server. Please try again.');
      setFieldErrors([]);
    }
  }

  if (status === 'success') {
    return (
      <div role="status" className="space-y-3 border border-rule bg-parchment p-8">
        <h3 className="font-serif text-[22px] font-semibold text-ink">Thank you</h3>
        <p className="font-sans text-[15px] leading-relaxed text-ink/80">
          Your vendor application has been received. The committee will review it and, if
          approved, will email you a link to complete your full registration and agreement.
        </p>
      </div>
    );
  }

  const disabled = status === 'submitting';

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {status === 'error' && errorMessage ? (
        <div role="alert" className="space-y-2 rounded-sm border border-primary-800 bg-bone p-4">
          <p className="font-sans text-[15px] font-medium text-primary-800">{errorMessage}</p>
          {fieldErrors.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 font-sans text-[14px] text-ink/80">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <VendorFormField
        fieldKey="businessName"
        label="Business name"
        htmlType="text"
        value={state.businessName}
        onChange={(value) => handleChange('businessName', value)}
        disabled={disabled}
        required
        maxLength={200}
      />

      <VendorFormField
        fieldKey="tradingName"
        label="Trading name (if different)"
        htmlType="text"
        value={state.tradingName}
        onChange={(value) => handleChange('tradingName', value)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />

      <VendorFormField
        fieldKey="contactPersonName"
        label="Contact person name"
        htmlType="text"
        value={state.contactPersonName}
        onChange={(value) => handleChange('contactPersonName', value)}
        disabled={disabled}
        required
        maxLength={150}
      />

      <VendorFormField
        fieldKey="contactEmail"
        label="Contact email"
        htmlType="email"
        value={state.contactEmail}
        onChange={(value) => handleChange('contactEmail', value)}
        disabled={disabled}
        required
        maxLength={254}
      />

      <VendorFormField
        fieldKey="contactCellPhone"
        label="Contact cell phone"
        htmlType="tel"
        value={state.contactCellPhone}
        onChange={(value) => handleChange('contactCellPhone', value)}
        disabled={disabled}
        required
        maxLength={30}
      />

      <VendorCheckboxGroupField
        fieldKey="vendorCategory"
        label="Vendor category & products"
        options={CATEGORY_OPTIONS}
        value={state.vendorCategory}
        onChange={(value) => handleChange('vendorCategory', value)}
        disabled={disabled}
        required
      />

      <VendorFormField
        fieldKey="indicativeBoothCount"
        label="Indicative number of stands"
        htmlType="number"
        value={state.indicativeBoothCount}
        onChange={(value) => handleChange('indicativeBoothCount', value)}
        disabled={disabled}
        required
        min={1}
        step={1}
      />

      {/* Honeypot -- visually hidden, tab-unreachable, aria-hidden. Mirrors VendorRegisterForm. */}
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
        {status === 'submitting' ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}

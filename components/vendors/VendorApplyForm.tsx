'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/nos/Button';
import { VendorFormField } from './VendorFormField';
import { VendorCheckboxGroupField } from './VendorCheckboxGroupField';
import { VENDOR_APPLICATION_CATEGORIES } from '@/lib/vendor-applications';
import {
  validateVendorApplyFormClientSide,
  vendorApplyErrorsByField,
  type VendorApplyFieldKey,
  type VendorApplyFormValues,
} from '@/lib/vendor-apply-form-validation';
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

type VendorApplyFormState = VendorApplyFormValues;

const REQUIRED_SENTENCE = 'All fields are required unless marked optional.';
const SUMMARY_ID = 'vendor-apply-error-summary';
// Existing string: humaniseFieldError()'s own fallback sentence (lib/vendor-register-response.ts).
const SUMMARY_HEADING = 'Please check the highlighted fields.';

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

interface FieldError {
  key: VendorApplyFieldKey;
  message: string;
}

/** Moves focus to the field an error summary link points at (the first checkbox for the group). */
function focusField(key: VendorApplyFieldKey) {
  const target = document.getElementById(`vendor-register-${key}`);
  if (!target) return;
  const focusable =
    target instanceof HTMLFieldSetElement
      ? target.querySelector<HTMLInputElement>('input[type="checkbox"]')
      : target;
  focusable?.focus();
  focusable?.scrollIntoView({ block: 'center' });
}

export function VendorApplyForm() {
  const [state, setState] = useState<VendorApplyFormState>(INITIAL_STATE);
  const [hp, setHp] = useState(''); // honeypot -- never sent to the API
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);

  function handleChange(key: keyof VendorApplyFormState, value: string | string[]) {
    const next = { ...state, [key]: value };
    setState(next);
    // After an invalid submit, re-validate as the user corrects: a field that is now valid
    // drops its inline error, aria-invalid and summary entry. Fields not already flagged
    // never gain an error while typing.
    if (clientErrors.length > 0) {
      const flagged = new Set(clientErrors.map((entry) => entry.key));
      setClientErrors(
        vendorApplyErrorsByField(validateVendorApplyFormClientSide(next)).filter((entry) =>
          flagged.has(entry.key),
        ),
      );
    }
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

    const invalid = vendorApplyErrorsByField(validateVendorApplyFormClientSide(state));
    setClientErrors(invalid);
    if (invalid.length > 0) {
      setStatus('idle');
      setErrorMessage(null);
      setFieldErrors([]);
      // The summary mounts on this render; focus it once it is in the DOM.
      requestAnimationFrame(() => summaryRef.current?.focus());
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
          indicativeBoothCount: Number(state.indicativeBoothCount),
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
  const errorFor = (key: VendorApplyFieldKey) =>
    clientErrors.find((entry) => entry.key === key)?.message;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <p className="font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-ink">
        {REQUIRED_SENTENCE}
      </p>

      {clientErrors.length > 0 ? (
        <div ref={summaryRef} id={SUMMARY_ID} tabIndex={-1} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40">
          <div
            role="alert"
            className="space-y-2 rounded-sm border border-[var(--status-error)] bg-bone p-4"
          >
            <p className="font-sans text-[15px] font-medium text-[var(--status-error)]">
              {SUMMARY_HEADING}
            </p>
            <ul className="list-disc space-y-1 pl-5 font-sans text-[14px] text-ink">
              {clientErrors.map((entry) => (
                <li key={entry.key}>
                  <a
                    href={`#vendor-register-${entry.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      focusField(entry.key);
                    }}
                    className="underline underline-offset-2"
                  >
                    {entry.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === 'error' && errorMessage ? (
        <div
          role="alert"
          className="space-y-2 rounded-sm border border-[var(--status-error)] bg-bone p-4"
        >
          <p className="font-sans text-[15px] font-medium text-[var(--status-error)]">
            {errorMessage}
          </p>
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
        showRequirement
        error={errorFor('businessName')}
        autoComplete="organization"
      />

      <VendorFormField
        fieldKey="tradingName"
        label="Trading name (if different, optional)"
        htmlType="text"
        value={state.tradingName}
        onChange={(value) => handleChange('tradingName', value)}
        disabled={disabled}
        required={false}
        maxLength={200}
        autoComplete="organization"
        showRequirement
        error={errorFor('tradingName')}
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
        showRequirement
        error={errorFor('contactPersonName')}
        autoComplete="name"
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
        showRequirement
        error={errorFor('contactEmail')}
        autoComplete="email"
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
        showRequirement
        error={errorFor('contactCellPhone')}
        autoComplete="tel"
      />

      <VendorCheckboxGroupField
        fieldKey="vendorCategory"
        label="Vendor category & products"
        options={CATEGORY_OPTIONS}
        value={state.vendorCategory}
        onChange={(value) => handleChange('vendorCategory', value)}
        disabled={disabled}
        required
        showRequirement
        error={errorFor('vendorCategory')}
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
        inputMode="numeric"
        showRequirement
        error={errorFor('indicativeBoothCount')}
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

      <Button type="submit" disabled={disabled}>
        {status === 'submitting' ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  );
}

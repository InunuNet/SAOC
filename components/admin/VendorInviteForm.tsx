'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin "Invite a vendor" action (mission vendor-invite, M1/F1). POSTs to
 * /api/admin/vendors/applications/invite, which creates an already-approved
 * `vendorApplications` document (`origin: 'invited'`) and emails the existing approval email
 * with a fresh registration code. See
 * .agent/memory/project/specs/vendor-invite/goldens/README.md for the full decision record.
 *
 * Mirrors app/admin/login/LoginFormFields.tsx's input/label treatment and
 * components/admin/VendorApplicationReviewTable.tsx's error-banner markup (`role="alert"`,
 * same class names) -- no new visual design is introduced, per this project's "no invented
 * brand assets" rule.
 */

const INPUT_CLASS =
  'w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60';
const LABEL_CLASS = 'font-mono text-[11px] tracking-[0.16em] text-muted';

interface InviteFormState {
  businessName: string;
  contactPersonName: string;
  contactEmail: string;
}

interface InviteResponse {
  success?: boolean;
  id?: string;
  registrationCodeId?: string;
  error?: string;
  fieldErrors?: string[];
}

interface InviteSuccess {
  businessName: string;
  registrationCodeId: string;
}

const INITIAL_FORM: InviteFormState = {
  businessName: '',
  contactPersonName: '',
  contactEmail: '',
};

export function VendorInviteForm() {
  const router = useRouter();
  const [form, setForm] = useState<InviteFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<InviteSuccess | null>(null);

  function handleChange(field: keyof InviteFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors([]);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/vendors/applications/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const body = (await res.json()) as InviteResponse;

      if (!res.ok || !body.success || !body.registrationCodeId) {
        setError(body.error ?? 'Failed to send vendor invite.');
        setFieldErrors(body.fieldErrors ?? []);
        return;
      }

      setSuccess({ businessName: form.businessName, registrationCodeId: body.registrationCodeId });
      setForm(INITIAL_FORM);
      router.refresh();
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-rule bg-ivory px-6 py-6">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Invite a vendor</h2>
      <p className="mt-1 font-sans text-[14px] text-muted">
        Creates an already-approved application and emails the registration code directly,
        bypassing the public application step.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="invite-businessName" className={LABEL_CLASS}>
            Business name
          </label>
          <input
            id="invite-businessName"
            type="text"
            autoComplete="organization"
            value={form.businessName}
            onChange={(e) => handleChange('businessName', e.target.value)}
            required
            disabled={submitting}
            maxLength={200}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="invite-contactPersonName" className={LABEL_CLASS}>
            Contact name
          </label>
          <input
            id="invite-contactPersonName"
            type="text"
            autoComplete="name"
            value={form.contactPersonName}
            onChange={(e) => handleChange('contactPersonName', e.target.value)}
            required
            disabled={submitting}
            maxLength={150}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="invite-contactEmail" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="invite-contactEmail"
            type="email"
            autoComplete="email"
            value={form.contactEmail}
            onChange={(e) => handleChange('contactEmail', e.target.value)}
            required
            disabled={submitting}
            maxLength={254}
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <div role="alert" className="border border-rule bg-ivory px-4 py-3 font-sans text-[14px] text-ink">
            <p>{error}</p>
            {fieldErrors.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {fieldErrors.map((fieldError) => (
                  <li key={fieldError}>{fieldError}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {success && (
          <p className="font-sans text-[14px] text-ink">
            Invited {success.businessName} — registration code {success.registrationCodeId}.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-primary px-4 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Sending invite…' : 'Invite vendor'}
        </button>
      </form>
    </div>
  );
}

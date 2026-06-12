'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';

import { getFirebaseApp } from '@/lib/firebase';

type FormValues = {
  title: string;
  kind: string;
  date: string;
  endDate: string;
  venue: string;
  location: string;
  description: string;
  hostSocietyId: string;
};

const INITIAL: FormValues = {
  title: '',
  kind: '',
  date: '',
  endDate: '',
  venue: '',
  location: '',
  description: '',
  hostSocietyId: '',
};

const ALLOWED_KINDS = ['exhibition', 'meeting', 'show', 'workshop', 'social'] as const;

function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!v.title.trim()) errors.title = 'Title is required.';
  if (!v.kind || !ALLOWED_KINDS.includes(v.kind as (typeof ALLOWED_KINDS)[number])) {
    errors.kind = 'Please select an event type.';
  }
  const dateObj = v.date ? new Date(v.date) : null;
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj <= new Date()) {
    errors.date = 'Date must be in the future.';
  }
  if (v.endDate) {
    const endObj = new Date(v.endDate);
    if (isNaN(endObj.getTime()) || (dateObj && endObj < dateObj)) {
      errors.endDate = 'End date must be on or after start date.';
    }
  }
  if (!v.venue.trim()) errors.venue = 'Venue is required.';
  if (!v.location.trim()) errors.location = 'Location is required.';
  if (v.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  }
  return errors;
}

export function SubmitEventForm() {
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  function set(field: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setStatus('submitting');
    setServerError(null);

    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;
    if (!user) {
      setServerError('Please sign in again.');
      setStatus('error');
      return;
    }

    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      setServerError('Failed to get auth token. Please sign in again.');
      setStatus('error');
      return;
    }

    const payload: Record<string, string> = {
      title: values.title,
      kind: values.kind,
      date: values.date,
      venue: values.venue,
      location: values.location,
      description: values.description,
    };
    if (values.endDate) payload.endDate = values.endDate;
    if (values.hostSocietyId.trim()) payload.hostSocietyId = values.hostSocietyId.trim();

    try {
      const res = await fetch('/api/events/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        setStatus('success');
        setValues(INITIAL);
        return;
      }

      const data = (await res.json()) as { error?: string; field?: string };
      if (res.status === 401) {
        setServerError('Your session expired — please sign in again.');
        setStatus('error');
        return;
      }
      if (res.status === 400 && data.field) {
        setErrors({ [data.field]: data.error ?? 'Invalid value.' });
        setStatus('idle');
        return;
      }
      setServerError(data.error ?? 'Something went wrong. Please try again.');
      setStatus('error');
    } catch {
      setServerError('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <p className="text-green-700 text-sm" role="status">
        Submitted for council review. Thank you — we will be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div aria-live="polite" className="min-h-[1.25rem]">
        {serverError && <p className="text-red-600 text-sm">{serverError}</p>}
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Event title <span aria-hidden>*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={values.title}
          onChange={set('title')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
      </div>

      {/* Kind */}
      <div>
        <label htmlFor="kind" className="block text-sm font-medium mb-1">
          Event type <span aria-hidden>*</span>
        </label>
        <select
          id="kind"
          name="kind"
          required
          value={values.kind}
          onChange={set('kind')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Select type…</option>
          {ALLOWED_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
        {errors.kind && <p className="text-red-600 text-xs mt-1">{errors.kind}</p>}
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium mb-1">
          Start date <span aria-hidden>*</span>
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          value={values.date}
          onChange={set('date')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.date && <p className="text-red-600 text-xs mt-1">{errors.date}</p>}
      </div>

      {/* End date */}
      <div>
        <label htmlFor="endDate" className="block text-sm font-medium mb-1">
          End date <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          value={values.endDate}
          onChange={set('endDate')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.endDate && <p className="text-red-600 text-xs mt-1">{errors.endDate}</p>}
      </div>

      {/* Venue */}
      <div>
        <label htmlFor="venue" className="block text-sm font-medium mb-1">
          Venue <span aria-hidden>*</span>
        </label>
        <input
          id="venue"
          name="venue"
          type="text"
          required
          value={values.venue}
          onChange={set('venue')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.venue && <p className="text-red-600 text-xs mt-1">{errors.venue}</p>}
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          City / area <span aria-hidden>*</span>
        </label>
        <input
          id="location"
          name="location"
          type="text"
          required
          value={values.location}
          onChange={set('location')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.location && <p className="text-red-600 text-xs mt-1">{errors.location}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description <span aria-hidden>*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          value={values.description}
          onChange={set('description')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.description && <p className="text-red-600 text-xs mt-1">{errors.description}</p>}
      </div>

      {/* Host society */}
      <div>
        <label htmlFor="hostSocietyId" className="block text-sm font-medium mb-1">
          Host society ID <span className="text-gray-400 font-normal">(optional — Sanity document ID)</span>
        </label>
        <input
          id="hostSocietyId"
          name="hostSocietyId"
          type="text"
          value={values.hostSocietyId}
          onChange={set('hostSocietyId')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="px-5 py-2 bg-gray-900 text-white text-sm rounded disabled:opacity-50"
      >
        {status === 'submitting' ? 'Submitting…' : 'Submit event'}
      </button>
    </form>
  );
}

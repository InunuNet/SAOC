'use client';

import { useEffect, useRef, useState } from 'react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import type { NewsletterTopic } from '@/lib/newsletter-topics';

type View = 'form' | 'none';

interface PreferencesFormProps {
  token: string;
  /** Which host the page is on: that host's own topic is listed first. */
  site: 'saoc' | 'nos';
  /** Already masked on the server: the raw address never reaches this component. */
  maskedEmail: string;
  /** True once every topic has been removed; the form then offers "Subscribe again". */
  allRemoved: boolean;
  /** The topics the address is subscribed to now. */
  topics: NewsletterTopic[];
  /** Every topic the address has ever held: the checkboxes shown (a never-held topic is not offered). */
  available: NewsletterTopic[];
}

interface PreferencesResponse {
  success?: boolean;
  status?: string;
  topics?: NewsletterTopic[];
  error?: string;
  field?: string;
}

const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ink hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed';
const TEXT_BUTTON =
  'inline-flex min-h-11 items-center font-sans text-[14px] text-ink underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60 disabled:cursor-not-allowed';

function topicLabel(topic: NewsletterTopic): string {
  return topic === 'saoc' ? NEWSLETTER_COPY.topicLabelSaoc : NEWSLETTER_COPY.topicLabelNos;
}

function ownTopicFirst(site: 'saoc' | 'nos', topics: readonly NewsletterTopic[]): NewsletterTopic[] {
  const order: NewsletterTopic[] = site === 'nos' ? ['nos', 'saoc'] : ['saoc', 'nos'];
  return order.filter((topic) => topics.includes(topic));
}

export function PreferencesForm({ token, site, maskedEmail, allRemoved, topics, available }: PreferencesFormProps) {
  const [view, setView] = useState<View>(allRemoved ? 'none' : 'form');
  const [offered, setOffered] = useState<NewsletterTopic[]>(available);
  const [selected, setSelected] = useState<NewsletterTopic[]>(topics);
  const [message, setMessage] = useState(allRemoved ? NEWSLETTER_COPY.prefsAllUnsubscribedState : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const [outcomes, setOutcomes] = useState(0);

  // Moves keyboard and screen-reader focus to the outcome line after something the person did,
  // never on first load.
  useEffect(() => {
    if (outcomes > 0) statusRef.current?.focus();
  }, [outcomes]);

  function toggle(topic: NewsletterTopic, checked: boolean) {
    setSelected((current) => (checked ? [...current, topic] : current.filter((item) => item !== topic)));
  }

  async function send(payload: Record<string, unknown>): Promise<PreferencesResponse | null> {
    if (busy) return null;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      });
      const data: PreferencesResponse = await res.json().catch(() => ({}));
      if (res.ok) return data;
      // A 400 with no `field` is the invalid-link answer; a field error is a bad selection.
      setError(res.status === 400 && data.field === undefined
        ? NEWSLETTER_COPY.prefsTokenError
        : (data.error ?? NEWSLETTER_COPY.genericError));
      return null;
    } catch {
      setError(NEWSLETTER_COPY.genericError);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function showOutcome(data: PreferencesResponse) {
    setOutcomes((count) => count + 1);
    if (data.status === 'unsubscribed') {
      setSelected([]);
      setView('none');
      setMessage(NEWSLETTER_COPY.prefsAllUnsubscribedState);
      return;
    }
    const now = data.topics ?? [];
    setSelected(now);
    setOffered((current) => [...new Set([...current, ...now])]);
    setView('form');
    setMessage(NEWSLETTER_COPY.prefsSaved);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const data = await send({ topics: selected });
    if (data) showOutcome(data);
  }

  async function unsubscribeEverything() {
    const data = await send({ topics: [] });
    if (data) showOutcome(data);
  }

  async function subscribeAgain() {
    const data = await send({ restore: true });
    if (data) showOutcome(data);
  }

  return (
    <div>
      <p className="font-sans text-[16px] leading-[1.55] text-ink">{maskedEmail}</p>

      <div
        ref={statusRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="mt-6 font-sans text-[16px] leading-[1.55] text-ink empty:hidden focus:outline-none"
      >
        {message}
      </div>
      {error === '' ? null : (
        <p
          role="alert"
          className="mt-6 border border-primary-800 bg-bone px-4 py-3 font-sans text-[16px] leading-[1.55] text-primary-800"
        >
          {error}
        </p>
      )}

      {view === 'none' ? (
        <div className="mt-6">
          <button type="button" onClick={() => void subscribeAgain()} disabled={busy} aria-busy={busy} className={PRIMARY_BUTTON}>
            {NEWSLETTER_COPY.prefsSubscribeAgain}
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void save(event)} noValidate>
          <fieldset aria-label={NEWSLETTER_COPY.prefsHeading} className="mt-6 flex flex-col">
            {ownTopicFirst(site, offered).map((topic) => (
              <label key={topic} className="inline-flex min-h-11 cursor-pointer items-center gap-3 font-sans text-[16px] text-ink">
                <input
                  type="checkbox"
                  name="topics"
                  value={topic}
                  checked={selected.includes(topic)}
                  onChange={(event) => toggle(topic, event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                {topicLabel(topic)}
              </label>
            ))}
          </fieldset>
          <div className="mt-6">
            <button type="submit" disabled={busy} aria-busy={busy} className={PRIMARY_BUTTON}>
              {NEWSLETTER_COPY.prefsSave}
            </button>
          </div>
          <div className="mt-8 border-t border-rule pt-4">
            <button type="button" onClick={() => void unsubscribeEverything()} disabled={busy} className={TEXT_BUTTON}>
              {NEWSLETTER_COPY.unsubscribeAll}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

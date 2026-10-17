// =============================================================
// NOS — components/show/VisitDisclosure.tsx
// Server Component — the R11 disclosure surface on plan-your-visit (nos-v4
// plan-your-visit.html l.575-616): ONE gold surface holds one full status chip, then the
// items it covers, so the items carry no card, border or shadow of their own. The caller
// supplies every string (the aria-label and all copy); nothing is typed here.
//
// At <=700px (inclusive) the chip inside is tightened (0.06em tracking, 10px inline padding) and the
// surface takes 16px inline padding, so the verbatim chip label stays on one line at 390.
// The chip rule is important: the NOS marker rule in nos-structure.css outranks a utility.
// =============================================================

import type { ReactNode } from 'react';

import { Card } from '../nos/Card';
import { NosSection } from '../nos/NosSection';
import { SectionHeading } from '../nos/SectionHeading';
import { ConfirmationBadge } from './ConfirmationBadge';

export interface VisitDisclosureProps {
  /** The group's accessible name; names what the one chip inside covers. */
  label: string;
  /** `pale` is the v4 .on-pale variant, for a disclosure that sits on a tinted section. */
  tone?: 'gold' | 'pale';
  children: ReactNode;
}

const TONE_CLASSES: Record<NonNullable<VisitDisclosureProps['tone']>, string> = {
  gold: 'bg-[var(--gold)]',
  pale: 'on-pale bg-[var(--gold-100)]',
};

// The ruling is <=700px inclusive, which Tailwind's bare 700px variant does not compile to (it
// gives width < 700px), so the media query is spelled out. At <=419px the tracking drops to 0.02em.
// Whole class names, so Tailwind's source scan finds them.
// The :not([hidden]) on the 374 step raises its specificity so it beats the 419 step, which
// Tailwind emits later in the sheet.
const CHIP_FIT_CLASSES =
  '[@media(max-width:700px)]:[&_[data-confirmation-badge]]:!px-[10px] [@media(min-width:420px)_and_(max-width:700px)]:[&_[data-confirmation-badge]]:!tracking-[0.06em] [@media(max-width:419px)]:[&_[data-confirmation-badge]]:!tracking-[0.02em] [@media(max-width:374px)]:[&_[data-confirmation-badge]:not([hidden])]:!tracking-[0]';
const NARROW_PADDING_CLASS = '[@media(max-width:700px)]:px-4';

export function VisitDisclosure({ label, tone = 'gold', children }: VisitDisclosureProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-tone={tone}
      className={[
        'grid gap-5 rounded-[16px] px-[clamp(20px,3vw,32px)] pb-6 pt-5 shadow-sm',
        NARROW_PADDING_CLASS,
        TONE_CLASSES[tone],
        CHIP_FIT_CLASSES,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

// Codi P3 H8 (nos-v4/plan-your-visit.html l.575-616). The group's name is the golden's.
const GETTING_THERE_LABEL = 'Details to be confirmed by the show committee';

export interface VisitGettingThereItem {
  heading: string;
  body?: string | null;
  // Anything but 'confirmed' (including unset) counts as unconfirmed.
  status?: string | null;
  children?: ReactNode;
}

export interface VisitGettingThereProps {
  items: VisitGettingThereItem[];
  pendingLabel?: string | null;
  researchLabel?: string | null;
}

function GettingThereItem({ item }: { item: VisitGettingThereItem }) {
  return (
    <div className="grid gap-2">
      <h3 className="nos-opsz-32 font-serif text-[22px] leading-[1.2] text-ink">{item.heading}</h3>
      {item.body ? (
        <p className="font-sans text-[16px] leading-[1.55] text-[var(--ink-700)]">{item.body}</p>
      ) : null}
      {item.children}
    </div>
  );
}

// The section lede ("... has not been worked out yet") is only true while every item is
// unconfirmed, so it is withheld as soon as any item is confirmed. No items counts as every item
// unconfirmed; a missing or blank intro stays withheld.
export function gettingThereLede(
  intro: string | null | undefined,
  items: VisitGettingThereItem[]
): string | undefined {
  const text = intro?.trim();
  if (!text) return undefined;
  return items.every((item) => item.status !== 'confirmed') ? text : undefined;
}

// The Getting-there items, split by status. Confirmed items are plain headings with their body,
// first. Every other item (pending, research or unset) shares ONE gold group with one chip: the
// pending chip when any of them is pending or unset, else the research chip. All confirmed means
// no group at all. Order inside each part follows `items`.
export function VisitGettingThere({ items, pendingLabel, researchLabel }: VisitGettingThereProps) {
  const confirmed = items.filter((item) => item.status === 'confirmed');
  const unconfirmed = items.filter((item) => item.status !== 'confirmed');
  const chipStatus = unconfirmed.some((item) => item.status !== 'research')
    ? 'pending'
    : 'research';

  return (
    <>
      {confirmed.map((item) => (
        <GettingThereItem key={item.heading} item={item} />
      ))}
      {unconfirmed.length > 0 ? (
        <VisitDisclosure label={GETTING_THERE_LABEL}>
          <div>
            <ConfirmationBadge
              shortOnNarrow
              status={chipStatus}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </div>
          {unconfirmed.map((item) => (
            <GettingThereItem key={item.heading} item={item} />
          ))}
        </VisitDisclosure>
      ) : null}
    </>
  );
}

export interface VisitAttraction {
  _key?: string;
  name?: string | null;
  note?: string | null;
  url?: string | null;
}

export interface VisitAttractionsProps {
  // The section's h2, passed in by the page.
  title: string;
  attractions: VisitAttraction[];
  status?: string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
}

// The link's visible text is the same on every attraction, so its accessible name is that text
// followed by its own attraction's heading (aria-labelledby, existing text only, no composed label).
function AttractionBody({ attraction, id }: { attraction: VisitAttraction; id: string }) {
  const linkId = `${id}-link`;
  return (
    <>
      <h3 id={id} className="font-serif text-[18px] font-medium text-ink">
        {attraction.name}
      </h3>
      {attraction.note ? (
        <p className="mt-2 font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-muted">
          {attraction.note}
        </p>
      ) : null}
      {attraction.url ? (
        <a
          href={attraction.url}
          target="_blank"
          rel="noreferrer noopener"
          id={linkId}
          aria-labelledby={`${linkId} ${id}`}
          className="mt-1 inline-flex min-h-[44px] items-center font-sans text-[13px] underline underline-offset-2 hover:text-accent"
        >
          Visit website ↗
        </a>
      ) : null}
    </>
  );
}

// "While you are here", under the same status rule as Getting there. Confirmed: a plain section,
// the h2 and the existing item cards, no surface and no chip. Anything else (pending, research or
// unset): the h2, then ONE gold group with one chip (pending or unset beats research) holding the
// items with no card around them. No attractions renders nothing.
export function VisitAttractions({
  title,
  attractions,
  status,
  pendingLabel,
  researchLabel,
}: VisitAttractionsProps) {
  const shown = attractions.filter((attraction) => attraction.name);
  if (shown.length === 0) return null;

  const keyOf = (attraction: VisitAttraction, index: number) =>
    attraction._key ?? `${attraction.name}-${index}`;
  const headingId = (attraction: VisitAttraction, index: number) => {
    // The index first keeps ids unique even for duplicate keys; the key is made safe for an id.
    const safe = (attraction._key ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    return safe ? `visit-attraction-${index}-${safe}` : `visit-attraction-${index}`;
  };

  if (status === 'confirmed') {
    return (
      <section className="space-y-6">
        <SectionHeading as="h2" title={title} />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((attraction, index) => (
            <li key={keyOf(attraction, index)}>
              <Card className="h-full">
                <AttractionBody attraction={attraction} id={headingId(attraction, index)} />
              </Card>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeading as="h2" title={title} />
      <VisitDisclosure label={GETTING_THERE_LABEL}>
        <div>
          <ConfirmationBadge
            shortOnNarrow
            status={status === 'research' ? 'research' : 'pending'}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          />
        </div>
        {shown.map((attraction, index) => (
          <div key={keyOf(attraction, index)} className="grid gap-1">
            <AttractionBody attraction={attraction} id={headingId(attraction, index)} />
          </div>
        ))}
      </VisitDisclosure>
    </section>
  );
}

export interface VisitEmergencyContact {
  _key?: string;
  label?: string | null;
  number?: string | null;
  note?: string | null;
}

export interface VisitEmergencyProps {
  // The section's h2, passed in by the page.
  title: string;
  // The disclosure's aria-label, defined by the page.
  label: string;
  contacts: VisitEmergencyContact[];
  status?: string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
}

// A number worth dialling: digits, with an optional leading + and spaces between groups.
const PHONE_SHAPED = /^\+?\d[\d\s]*$/;

// The national numbers are facts, not the show committee's to confirm: always plain tel targets,
// whatever the status says. Only the on-site contact follows the status. The section is a
// full-bleed band of --gold (nos-v4 plan-your-visit.html l.277-279); the band marks the section, not a status.
export function VisitEmergency({
  title,
  label,
  contacts,
  status,
  pendingLabel,
  researchLabel,
}: VisitEmergencyProps) {
  const shown = contacts.filter((contact) => contact.label);
  if (shown.length === 0) return null;

  const dialContacts = shown.filter((contact) => PHONE_SHAPED.test(contact.number ?? ''));
  const onSiteContacts = shown.filter((contact) => !PHONE_SHAPED.test(contact.number ?? ''));
  const keyOf = (contact: VisitEmergencyContact, index: number) =>
    contact._key ?? `${contact.label}-${index}`;

  return (
    <NosSection className="bg-[var(--gold)]" wrapClassName="space-y-6">
      <SectionHeading as="h2" title={title} className="mb-8" />
      {dialContacts.length > 0 ? (
        <dl className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-3">
          {dialContacts.map((contact, index) => (
            <div key={keyOf(contact, index)} className="flex flex-col gap-1">
              <dt className="font-sans text-[16px] leading-[1.55] text-[var(--ink-700)]">
                {contact.label}
              </dt>
              <dd className="order-first font-serif text-primary">
                <a
                  href={`tel:${(contact.number ?? '').replace(/[^\d+]/g, '')}`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center text-[clamp(2.4rem,3vw,3rem)] font-light leading-[1.1] underline-offset-4 hover:underline"
                >
                  {contact.number}
                </a>
              </dd>
              {contact.note ? (
                <dd className="font-sans text-[14px] leading-[1.55] text-[var(--ink-500)]">
                  {contact.note}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}
      {onSiteContacts.length > 0 && status === 'confirmed' ? (
        <div className="space-y-4">
          {onSiteContacts.map((contact, index) => (
            <div key={keyOf(contact, index)} className="grid gap-2">
              <h3 className="nos-opsz-32 font-serif text-[20px] leading-[1.2] text-ink">
                {contact.label}
              </h3>
              {contact.number ? (
                <p className="font-sans text-[16px] font-semibold text-[var(--ink-500)]">
                  {contact.number}
                </p>
              ) : null}
              {contact.note ? (
                <p className="font-sans text-[15px] leading-[1.55] text-[var(--ink-500)]">
                  {contact.note}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {onSiteContacts.length > 0 && status !== 'confirmed' ? (
        <VisitDisclosure label={label} tone="pale">
          <div>
            <ConfirmationBadge
              shortOnNarrow
              status={status === 'research' ? 'research' : 'pending'}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </div>
          {onSiteContacts.map((contact, index) => (
            <div key={keyOf(contact, index)} className="grid gap-2">
              <h3 className="nos-opsz-32 font-serif text-[20px] leading-[1.2] text-ink">
                {contact.label}
              </h3>
              {contact.note ? (
                <p className="font-sans text-[15px] leading-[1.55] text-[var(--ink-500)]">
                  {contact.note}
                </p>
              ) : null}
            </div>
          ))}
        </VisitDisclosure>
      ) : null}
    </NosSection>
  );
}

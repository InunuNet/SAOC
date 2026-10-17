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

// `max-[700px]` compiles to width < 700px; the ruling is <=700px, so the media query is spelled out.
// Whole class names, so Tailwind's source scan finds them.
const CHIP_FIT_CLASSES =
  '[@media(max-width:700px)]:[&_[data-confirmation-badge]]:!px-[10px] [@media(max-width:700px)]:[&_[data-confirmation-badge]]:!tracking-[0.06em]';
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

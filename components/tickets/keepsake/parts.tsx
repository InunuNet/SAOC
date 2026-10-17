// Shared, stateless pieces of the keepsake ticket (goldens/f18b HANDOFF section 3.1): the stub,
// the price, the scarcity line and the icons. Every string comes from lib/data/ticket-presentation
// (the design's copy), every number from the view model. Geometry lives in nos-structure.css
// under the `nk-` prefix.

import Image from 'next/image';
import type { CSSProperties } from 'react';

import { formatRand } from '@/components/nos/cheapest-admission';
import {
  TICKET_COPY,
  TICKET_EMBLEM,
  type TicketProduct,
} from '@/lib/data/ticket-presentation';

import type { KeepsakeCardVm } from './types';

const EMBLEM_WIDTH_PX = 45;
const EMBLEM_HEIGHT_PX = 30;
const STUB_PHOTO_SIZES = '(max-width: 700px) 50vw, 300px';

type FieldStyle = CSSProperties & { '--nk-field': string };

export function ArrowIcon() {
  return (
    <svg className="nk-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg className="nk-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg className="nk-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

interface TicketStubProps {
  product: TicketProduct;
  numeral: string;
  caption: string;
  admit: string;
  soldOut: boolean;
  photo?: boolean;
}

/** The decorative stub: photograph or field colour, the numeral, and the emblem band. */
export function TicketStub({
  product,
  numeral,
  caption,
  admit,
  soldOut,
  photo = true,
}: TicketStubProps) {
  const style: FieldStyle = { '--nk-field': `var(${product.fieldVar})` };
  const showPhoto = photo && product.photo !== null;
  return (
    <div data-ticket-stub="" aria-hidden="true" className="nk-stub" style={style}>
      <div className={showPhoto ? 'nk-face has-photo' : 'nk-face'}>
        {showPhoto && product.photo ? (
          <Image
            src={product.photo}
            alt=""
            fill
            sizes={STUB_PHOTO_SIZES}
            style={{ objectFit: 'cover', objectPosition: product.focus }}
          />
        ) : null}
        <span data-ticket-numeral="" className="nk-num">
          {numeral}
        </span>
        <span className="nk-numlab">{caption}</span>
      </div>
      <div className="nk-band">
        <Image
          src={TICKET_EMBLEM}
          alt=""
          width={EMBLEM_WIDTH_PX}
          height={EMBLEM_HEIGHT_PX}
          unoptimized
        />
        <span className="nk-admit">{admit}</span>
      </div>
      {soldOut ? <span className="nk-stamp">{TICKET_COPY.soldOutStamp}</span> : null}
    </div>
  );
}

interface TicketPriceProps {
  price: number;
  each: boolean;
  muted: boolean;
}

/** "R" raised, whole rand, "each" on per-session prices; formatRand keeps cents when real. */
export function TicketPrice({ price, each, muted }: TicketPriceProps) {
  const text = formatRand(price);
  return (
    <p data-ticket-price="" className={muted ? 'nk-price is-muted' : 'nk-price'}>
      <span className="nk-cur">{text.slice(0, 1)}</span>
      {text.slice(1)}
      {each ? <span className="nk-each">{TICKET_COPY.each}</span> : null}
    </p>
  );
}

interface TicketCountProps {
  vm: KeepsakeCardVm;
  partner: string | null;
}

/** The scarcity line: masked by every state above `low`, absent when there is no real count. */
export function TicketCount({ vm, partner }: TicketCountProps) {
  const { scarcity, state } = vm;
  if (!scarcity || (state !== 'available' && state !== 'low')) return null;
  const isEarlyBird = vm.slug.endsWith('early-bird');
  return (
    <p data-ticket-count="" className="nk-count" aria-live="polite">
      <span className="nk-n">{`${scarcity.remaining} of ${scarcity.total}`}</span>
      {` ${scarcity.label}`}
      {state === 'low' ? <span className="nk-tag">{TICKET_COPY.fewLeft}</span> : null}
      {isEarlyBird && partner ? (
        <span className="nk-shared">{`${TICKET_COPY.sharedWith} ${partner}`}</span>
      ) : null}
    </p>
  );
}

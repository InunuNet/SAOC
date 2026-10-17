// The shared early-bird pool (goldens/f18b HANDOFF section 3.4): one royal panel above the two
// pass cards, reading the same real pool value as both of their scarcity lines. With no real
// pool value nothing renders (R7), never a sample number. The bracket joining the panel to the
// two cards shows from 960px up (nos-structure.css). A provisional total is hidden on a public
// build (no numeral, no figure in the words) and shown marked on the beta preview.

import {
  TICKET_COPY,
  TICKET_PRODUCTS,
  poolOutText,
  poolOutTextProvisional,
  poolText,
  poolTextProvisional,
} from '@/lib/data/ticket-presentation';

import { countDisplay } from './days';
import { faceName } from './TicketMini';
import type { KeepsakePool } from './types';

const POOL_TITLE_ID = 'pool-title';

export interface PoolBannerProps {
  pool: KeepsakePool | null;
  // CMS names of the two passes that share the pool (default: the design's product names).
  names?: { weekend?: string | null; day?: string | null };
  // Beta preview: a provisional total shows, marked "Not yet confirmed". Public: hidden.
  showProvisional?: boolean;
}

export function PoolBanner({ pool, names, showProvisional = false }: PoolBannerProps) {
  if (!pool) return null;
  const out = pool.remaining <= 0;
  const counts = countDisplay(pool.provisional, showProvisional);
  const withheld = counts === 'withhold';
  const placeholder = counts === 'placeholder';
  const weekendName = faceName(names?.weekend ?? TICKET_PRODUCTS.weekend.name);
  const dayName = faceName(names?.day ?? TICKET_PRODUCTS.day.name);

  let title: string = out ? TICKET_COPY.poolOutTitle : TICKET_COPY.poolTitle;
  let text: string = out ? poolOutText(pool.total) : poolText(pool.total);
  if (withheld) {
    title = out ? TICKET_COPY.poolOutTitle : TICKET_COPY.poolTitleProvisional;
    text = out
      ? poolOutTextProvisional(weekendName, dayName)
      : poolTextProvisional(weekendName, dayName);
  }
  return (
    <>
      <div
        data-pool-banner=""
        className={[out ? 'nk-pool is-out' : 'nk-pool', withheld ? 'is-bare' : '']
          .filter(Boolean)
          .join(' ')}
        role="group"
        aria-labelledby={POOL_TITLE_ID}
      >
        {withheld ? null : (
          <div
            className="nk-pool-num"
            aria-hidden="true"
            data-placeholder={placeholder ? 'true' : undefined}
          >
            <span>{pool.remaining}</span>
            <small>{`of ${pool.total}`}</small>
          </div>
        )}
        <strong id={POOL_TITLE_ID}>{title}</strong>
        <p>{text}</p>
        {placeholder ? <span className="nk-unconfirmed">{TICKET_COPY.notYetConfirmed}</span> : null}
      </div>
      <div data-pool-bracket="" className="nk-pool-bracket" aria-hidden="true" />
    </>
  );
}

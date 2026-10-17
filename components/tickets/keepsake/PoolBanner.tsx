// The shared early-bird pool (goldens/f18b HANDOFF section 3.4): one royal panel above the two
// pass cards, reading the same real pool value as both of their scarcity lines. With no real
// pool value nothing renders (R7), never a sample number. The bracket joining the panel to the
// two cards shows from 960px up (nos-structure.css).

import { TICKET_COPY, poolOutText, poolText } from '@/lib/data/ticket-presentation';

import type { KeepsakePool } from './types';

const POOL_TITLE_ID = 'pool-title';

export interface PoolBannerProps {
  pool: KeepsakePool | null;
}

export function PoolBanner({ pool }: PoolBannerProps) {
  if (!pool) return null;
  const out = pool.remaining <= 0;
  return (
    <>
      <div
        data-pool-banner=""
        className={out ? 'nk-pool is-out' : 'nk-pool'}
        role="group"
        aria-labelledby={POOL_TITLE_ID}
      >
        <div className="nk-pool-num" aria-hidden="true">
          <span>{pool.remaining}</span>
          <small>{`of ${pool.total}`}</small>
        </div>
        <strong id={POOL_TITLE_ID}>{out ? TICKET_COPY.poolOutTitle : TICKET_COPY.poolTitle}</strong>
        <p>{out ? poolOutText(pool.total) : poolText(pool.total)}</p>
      </div>
      <div data-pool-bracket="" className="nk-pool-bracket" aria-hidden="true" />
    </>
  );
}

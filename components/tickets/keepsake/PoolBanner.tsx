// The shared early-bird pool (goldens/f18b HANDOFF section 3.4): one royal panel above the two
// pass cards, reading the same real pool value as both of their scarcity lines. With no real
// pool value nothing renders (R7), never a sample number. The bracket joining the panel to the
// two cards shows from 960px up (nos-structure.css).

import {
  POOL_OUT_TEXT_NO_COUNT,
  POOL_TEXT_NO_COUNT,
  TICKET_COPY,
  poolOutText,
  poolText,
} from '@/lib/data/ticket-presentation';

import type { CountDisplay, KeepsakePool } from './types';

const POOL_TITLE_ID = 'pool-title';

export interface PoolBannerProps {
  pool: KeepsakePool | null;
  // 'withhold': the total is a placeholder on a public build, so the numeral and every figure go.
  counts?: CountDisplay;
}

export function PoolBanner({ pool, counts = 'real' }: PoolBannerProps) {
  if (!pool) return null;
  const out = pool.remaining <= 0;
  const withheld = counts === 'withhold';
  const placeholder = counts === 'placeholder';
  let title: string = out ? TICKET_COPY.poolOutTitle : TICKET_COPY.poolTitle;
  if (withheld && !out) title = TICKET_COPY.poolTitleNoCount;
  let text: string = out ? poolOutText(pool.total) : poolText(pool.total);
  if (withheld) text = out ? POOL_OUT_TEXT_NO_COUNT : POOL_TEXT_NO_COUNT;
  return (
    <>
      <div
        data-pool-banner=""
        className={[out ? 'nk-pool is-out' : 'nk-pool', withheld ? 'is-bare' : '']
          .filter(Boolean)
          .join(' ')}
        data-placeholder={placeholder ? 'true' : undefined}
        role="group"
        aria-labelledby={POOL_TITLE_ID}
      >
        {withheld ? null : (
          <div className="nk-pool-num" aria-hidden="true">
            <span>{pool.remaining}</span>
            <small>{`of ${pool.total}`}</small>
          </div>
        )}
        <strong id={POOL_TITLE_ID}>{title}</strong>
        <p>{text}</p>
        {placeholder ? <span className="nk-unconfirmed">{TICKET_COPY.unconfirmed}</span> : null}
      </div>
      <div data-pool-bracket="" className="nk-pool-bracket" aria-hidden="true" />
    </>
  );
}

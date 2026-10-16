// F16 (launch-weekend, R31-A2) — Server Component. The visitor admission products as ruled
// typographic rows: one row per product family (Day / Weekend / VIP), early-bird and standard
// prices side by side, ONE primary action per row. Prices and actions render only while sales
// are open. No photograph anywhere (R53 #2). Geometry lives in nos-structure.css (F16 block).
import Link from 'next/link';

// Relative imports (not "@/"): check-d-render.mts loads this file through tsx's CJS path, which
// does not resolve the tsconfig alias.
import { formatRand } from '../nos/cheapest-admission.ts';
import { Button } from '../nos/Button.tsx';
import type { AdmissionRow } from '../../lib/admission-rows.ts';

interface AdmissionRowsProps {
  rows: AdmissionRow[];
  salesOpen: boolean;
  /** The ticketsPage singleton's buy label, fallback "Buy Ticket". */
  buyLabel: string;
}

function formatCutoff(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' });
}

export function AdmissionRows({ rows, salesOpen, buyLabel }: AdmissionRowsProps) {
  return (
    <ul data-ticket-rows="" className="nos-ticket-rows">
      {rows.map((row) => (
        <li key={row.key} data-ticket-row="" className="nos-ticket-row">
          <div className="nos-ticket-row-main">
            <h3 data-ticket-row-name="">{row.name}</h3>
            {row.requiresDaySelection ? (
              <p data-ticket-day-note="" className="nos-ticket-note">
                You must choose a day when you book.
              </p>
            ) : null}
            {salesOpen && row.earlyBirdEnds ? (
              <p className="nos-ticket-note">Early-bird pricing ends {formatCutoff(row.earlyBirdEnds)}.</p>
            ) : null}
          </div>
          {salesOpen ? (
            <dl data-ticket-prices="" className="nos-ticket-prices">
              {row.tiers.map((tier, i) => (
                <div key={`${tier.kind}-${tier.slug}`} data-ticket-tier={tier.kind} data-dominant={i === 0 ? 'true' : undefined}>
                  <dt className={tier.name === row.name ? 'sr-only' : undefined}>{tier.name}</dt>
                  <dd data-ticket-price="" data-placeholder={row.provisional ? 'true' : undefined}>
                    {tier.price === 0 ? 'Free' : formatRand(tier.price)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {salesOpen ? (
            <Button as={Link} data-ticket-row-action="" href={`/tickets/${row.actionSlug}`} variant="primary" className="nos-ticket-action">
              {buyLabel}
              <span className="sr-only">{` — ${row.name}`}</span>
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// F16 (launch-weekend, R31-A2), amended by F17 scope E — Server Component. The visitor admission
// products as ruled typographic rows: one row per product family (Day / Weekend / VIP). Every
// price carries a visible caption (its own CMS SKU name) and its OWN secondary (ghost) action to
// its own SKU, so the early-bird tier selling out leaves the regular ticket reachable. Prices and
// actions render only while sales are open. No photograph anywhere (R53 #2). Geometry lives in
// nos-structure.css (F16 block).
import Link from 'next/link';

// Relative imports (not "@/"): check-d-render.mts loads this file through tsx's CJS path, which
// does not resolve the tsconfig alias.
import { formatRand } from '../nos/cheapest-admission.ts';
import { Button } from '../nos/Button.tsx';
import type { AdmissionRow, AdmissionTier } from '../../lib/admission-rows.ts';

interface AdmissionRowsProps {
  rows: AdmissionRow[];
  salesOpen: boolean;
  /** The ticketsPage singleton's buy label, fallback "Buy Ticket". */
  buyLabel: string;
  /** The ticketsPage singleton's sold-out message, fallback "Sold out". */
  soldOutLabel?: string;
}

const FALLBACK_SOLD_OUT_LABEL = 'Sold out';

function formatCutoff(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' });
}

/** A tier carries an action unless an earlier tier in the row is the same SKU. */
function carriesAction(row: AdmissionRow, index: number): boolean {
  return !row.tiers.slice(0, index).some((earlier) => earlier.slug === row.tiers[index].slug);
}

function TierAction({
  tier,
  buyLabel,
  soldOutLabel,
}: {
  tier: AdmissionTier;
  buyLabel: string;
  soldOutLabel: string;
}) {
  const skuName = <span className="sr-only">{` — ${tier.name}`}</span>;
  if (tier.soldOut) {
    return (
      <Button
        as="span"
        data-ticket-row-action=""
        data-sold-out=""
        aria-disabled="true"
        variant="ghost"
        className="nos-ticket-action cursor-not-allowed !text-muted hover:!bg-transparent"
      >
        {soldOutLabel}
        {skuName}
      </Button>
    );
  }
  return (
    <Button
      as={Link}
      data-ticket-row-action=""
      href={`/tickets/${tier.slug}`}
      variant="ghost"
      className="nos-ticket-action"
    >
      {buyLabel}
      {skuName}
    </Button>
  );
}

export function AdmissionRows({
  rows,
  salesOpen,
  buyLabel,
  soldOutLabel = FALLBACK_SOLD_OUT_LABEL,
}: AdmissionRowsProps) {
  return (
    <ul data-ticket-rows="" className="nos-ticket-rows">
      {rows.map((row) => {
        const dual = row.tiers.length > 1;
        return (
          <li key={row.key} data-ticket-row="" className="nos-ticket-row">
            <div className="nos-ticket-row-main">
              <h3 data-ticket-row-name="">{row.name}</h3>
              {row.requiresDaySelection ? (
                <p data-ticket-day-note="" className="nos-ticket-note">
                  You must choose a day when you book.
                </p>
              ) : null}
              {salesOpen && row.earlyBirdEnds ? (
                <p className="nos-ticket-note">
                  Early-bird pricing ends {formatCutoff(row.earlyBirdEnds)}.
                </p>
              ) : null}
            </div>
            {salesOpen ? (
              <ul data-ticket-prices="" className="nos-ticket-prices">
                {row.tiers.map((tier, i) => (
                  <li key={`${tier.kind}-${tier.slug}`} data-ticket-tier={tier.kind}>
                    <span
                      data-ticket-caption=""
                      className={
                        !dual && tier.name === row.name
                          ? 'nos-ticket-caption sr-only'
                          : 'nos-ticket-caption'
                      }
                    >
                      {tier.name}
                    </span>
                    <span
                      data-ticket-price=""
                      data-placeholder={row.provisional ? 'true' : undefined}
                    >
                      {tier.price === 0 ? 'Free' : formatRand(tier.price)}
                    </span>
                    {carriesAction(row, i) ? (
                      <TierAction tier={tier} buyLabel={buyLabel} soldOutLabel={soldOutLabel} />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { isUnsourced } from '@/components/ui/provenance';

export interface SanityAward {
  _id: string;
  code: string;
  name: string;
  description?: string | null;
  threshold?: string | null;
  order?: number | null;
}

interface AwardsGridProps {
  awards: SanityAward[];
  /** True on the public build: award thresholds and criteria the Council has not supplied are not rendered. */
  withhold?: boolean;
}

// Display order by code only (no data change): the points-ranked awards first, in rank order,
// then every other award.
const RANKED_CODES = ['FCC', 'AM', 'HCC'];

function thresholdOf(award: SanityAward, withhold: boolean): string | null {
  if (!award.threshold || award.threshold === '—') return null;
  return withhold && isUnsourced(award.threshold) ? null : award.threshold;
}

// Codes arrive as e.g. "FCC/SAOC"; the rank is keyed on the part before the slash.
function baseCode(award: SanityAward): string {
  return award.code.split('/')[0].trim();
}

// The award ladder, one ruled list: code, name and points from the same award data, in points order.
export function AwardsGrid({ awards, withhold = false }: AwardsGridProps) {
  const ranked = RANKED_CODES.flatMap((code) => awards.filter((award) => baseCode(award) === code));
  const other = awards.filter((award) => !RANKED_CODES.includes(baseCode(award)));

  return (
    <div data-placeholder={withhold ? undefined : 'true'} className="space-y-6">
      <dl className="border-t border-rule">
        {[...ranked, ...other].map((award) => {
          const threshold = thresholdOf(award, withhold);
          return (
            <div
              key={award._id}
              className="grid grid-cols-1 gap-x-8 gap-y-1 border-b border-rule py-4 sm:grid-cols-[max-content_1fr]"
            >
              <dt className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted sm:min-w-24">
                {award.code}
              </dt>
              <dd className="font-sans text-[16px] leading-[1.55] text-ink">
                {award.name}
                {threshold ? ` — ${threshold}` : ''}
              </dd>
            </div>
          );
        })}
      </dl>

      {withhold ? null : <PlaceholderMarker />}
    </div>
  );
}

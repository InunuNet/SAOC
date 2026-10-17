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

// Display grouping by code only (no data change): the points-ranked awards first, in rank
// order, then every other award under an "Other awards" label.
const RANKED_CODES = ['FCC', 'AM', 'HCC'];
const OTHER_AWARDS_LABEL = 'Other awards';

function thresholdOf(award: SanityAward, withhold: boolean): string | null {
  if (!award.threshold || award.threshold === '—') return null;
  return withhold && isUnsourced(award.threshold) ? null : award.threshold;
}

function descriptionOf(award: SanityAward, withhold: boolean): string | null {
  if (!award.description) return null;
  return withhold && isUnsourced(award.description) ? null : award.description;
}

interface AwardCardsProps {
  awards: SanityAward[];
  headingLevel: 'h3' | 'h4';
  withhold: boolean;
}

function AwardCards({ awards, headingLevel, withhold }: AwardCardsProps) {
  const Heading = headingLevel;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {awards.map((award) => {
        const threshold = thresholdOf(award, withhold);
        const description = descriptionOf(award, withhold);
        return (
          <div key={award._id} className="flex flex-col border border-rule bg-parchment p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {award.code}
            </p>
            <Heading className="mt-2 font-serif text-[20px] font-semibold leading-snug text-ink">
              {award.name}
            </Heading>
            {threshold ? (
              <p className="mt-1 font-mono text-[12px] text-ink/70">{threshold}</p>
            ) : null}
            {description ? (
              <p className="mt-3 font-sans text-[16px] leading-[1.55] text-ink/75">{description}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// Codes arrive as e.g. "FCC/SAOC"; the rank is keyed on the part before the slash.
function baseCode(award: SanityAward): string {
  return award.code.split('/')[0].trim();
}

export function AwardsGrid({ awards, withhold = false }: AwardsGridProps) {
  const ranked = RANKED_CODES.flatMap((code) => awards.filter((award) => baseCode(award) === code));
  const other = awards.filter((award) => !RANKED_CODES.includes(baseCode(award)));

  return (
    <div
      data-placeholder={withhold ? undefined : 'true'}
      className="space-y-12"
    >
      {/* Award ladder: code and name (with threshold) from the same award data, in points order. */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {[...ranked, ...other].map((award) => {
          const threshold = thresholdOf(award, withhold);
          return (
            <div key={award._id} className="contents">
              <dt className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted">
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

      <AwardCards awards={ranked} headingLevel="h3" withhold={withhold} />

      {other.length > 0 ? (
        <div className="space-y-6">
          <h3 className="font-serif text-[20px] font-semibold text-ink">{OTHER_AWARDS_LABEL}</h3>
          <AwardCards awards={other} headingLevel="h4" withhold={withhold} />
        </div>
      ) : null}

      {withhold ? null : <PlaceholderMarker />}
    </div>
  );
}

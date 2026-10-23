import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { isUnsourced } from '@/components/ui/provenance';

const STATS = [
  { value: '21', label: 'Affiliated Societies' },
  { value: '1968', label: 'Founding Year' },
  { value: '18', label: 'National Shows Hosted' },
  { value: '56', label: 'Accredited Judges' },
] as const;

// The Council's About copy sources the founding year only; the other three figures are not in its
// Drive, so the public build shows this one (F19, vote 1C).
const SOURCED_STATS = STATS.filter((stat) => stat.value === '1968');

export interface MissionBlockProps {
  missionText?: string | null;
  /** True on the public build: facts the Council has not supplied are not rendered. */
  withhold?: boolean;
}

export function MissionBlock({ missionText, withhold = false }: MissionBlockProps) {
  const hasCms = typeof missionText === 'string' && missionText.trim().length > 0;
  const cmsUnsourced = typeof missionText === 'string' && hasCms && isUnsourced(missionText);
  const stats = withhold ? SOURCED_STATS : STATS;

  const statList = (
    <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-8 border-t border-rule pt-10 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="font-serif font-light text-[clamp(36px,4vw,56px)] text-primary leading-none">
            {stat.value}
          </dt>
          <dd className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-2">
            {stat.label}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section className="py-24 bg-parchment">
      <div className="saoc-container">
        {/* Two-column editorial split: heading left, body right */}
        <div className="grid md:grid-cols-[5fr_7fr] gap-x-16 gap-y-10 mb-16">
          {/* Left: eyebrow + headline */}
          <div>
            <div className="mb-5">
              <span className="eyebrow">Our purpose</span>
            </div>
            <h2 className="font-serif font-normal min-[942px]:font-light text-[clamp(28px,3.4vw,46px)] leading-[1.08] tracking-[-0.015em] text-primary">
              Where South African growers bring their finest blooms to the bench.
            </h2>
          </div>

          {/* Right: body text */}
          <div className="flex flex-col gap-6 self-end">
            {hasCms && !cmsUnsourced ? (
              <p className="font-sans text-[16px] leading-[1.55] text-ink">{missionText}</p>
            ) : withhold ? null : (
              <div data-placeholder="true" className="flex flex-col items-start gap-1">
                {cmsUnsourced ? (
                  <p className="font-sans text-[16px] leading-[1.55] text-ink">{missionText}</p>
                ) : (
                  <p className="font-sans text-[16px] leading-[1.55] text-ink">
                    SAOC exists to promote the culture, hybridisation and appreciation of orchids
                    across South Africa. We do this through a federated network of 21 societies, a
                    nationally accredited judging system first standardised in 1990, and our annual
                    publication <em>Orchids South Africa</em>.
                  </p>
                )}
                <PlaceholderMarker />
              </div>
            )}
            <p className="font-sans text-[16px] leading-[1.55] text-ink">
              Our remit is orchids <strong>in cultivation</strong> — on the show bench, in the
              greenhouse, and in the community. For indigenous species in the wild, our sibling
              organisation{' '}
              <a
                href="https://wildorchids.co.za"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-link"
              >
                Wild Orchids of Southern Africa
              </a>{' '}
              leads that work.
            </p>
          </div>
        </div>

        {/* Stats: the whole row is marked on the beta preview, only the founding year is public. */}
        {withhold ? (
          statList
        ) : (
          <div data-placeholder="true" className="flex flex-col items-start gap-4">
            {statList}
            <PlaceholderMarker />
          </div>
        )}
      </div>
    </section>
  );
}

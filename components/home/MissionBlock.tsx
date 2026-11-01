import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { isUnsourced } from '@/components/ui/provenance';

// The Council's About copy sources the founding year only. Lee-Ann asked for the other figures to be
// left out (24 Oct 2026), so this is the one stat.
const STATS = [{ value: '1968', label: 'Founding Year' }] as const;

export interface MissionBlockProps {
  missionText?: string | null;
  /** True on the public build: facts the Council has not supplied are not rendered. */
  withhold?: boolean;
}

export function MissionBlock({ missionText, withhold = false }: MissionBlockProps) {
  const hasCms = typeof missionText === 'string' && missionText.trim().length > 0;
  const cmsUnsourced = typeof missionText === 'string' && hasCms && isUnsourced(missionText);

  const statList = (
    <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-8 border-t border-rule pt-10 md:grid-cols-4">
      {STATS.map((stat) => (
        <div key={stat.label}>
          <dt className="font-serif tracking-[-0.015em] font-light text-[clamp(36px,4vw,56px)] text-primary leading-none">
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
            <h2 className="font-serif font-light text-[length:var(--h2-role)] leading-[1.15] tracking-[-0.015em] text-primary">
              Where South African growers bring their finest blooms to the bench.
            </h2>
          </div>

          {/* Right: body text */}
          <div className="flex flex-col gap-6 self-end">
            {hasCms && !cmsUnsourced ? (
              <p className="font-sans text-[16px] leading-[1.55] text-ink">{missionText}</p>
            ) : !withhold && cmsUnsourced ? (
              <p data-placeholder="true" className="font-sans text-[16px] leading-[1.55] text-ink">
                {missionText}
              </p>
            ) : null}
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
            {!withhold && cmsUnsourced ? <PlaceholderMarker /> : null}
          </div>
        </div>

        {statList}
      </div>
    </section>
  );
}

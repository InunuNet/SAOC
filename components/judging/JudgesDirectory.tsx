import Link from 'next/link';
import type { SanityImageSource } from '@sanity/image-url';

export interface SanityJudge {
  name: string;
  region: string | null;
  accreditedSince: number | null;
  photo: SanityImageSource | null;
}

export interface JudgesDirectoryProps {
  judges: SanityJudge[];
  showPublicDirectory: boolean;
}

export function JudgesDirectory({ judges, showPublicDirectory }: JudgesDirectoryProps) {
  if (!showPublicDirectory || judges.length === 0) {
    return (
      <div className="border border-rule bg-parchment p-6 max-w-3xl">
        <p className="font-sans text-[15px] leading-relaxed text-ink/70">
          The full accredited judges directory is available to SAOC members. Log in through
          your affiliated society, or get in touch with the council directly.
        </p>
        <Link
          href="/contact"
          className="mt-3 inline-block font-sans text-[13px] font-medium text-ink underline underline-offset-2 hover:text-primary"
        >
          Contact SAOC →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {judges.map((judge, i) => (
        <div
          key={`${judge.name}-${i}`}
          className="flex items-center gap-4 border border-rule bg-parchment p-5"
        >
          <div>
            <p className="font-serif text-[17px] font-semibold text-ink">{judge.name}</p>
            {judge.region ? (
              <p className="font-sans text-[13px] text-ink/70">{judge.region}</p>
            ) : null}
            {judge.accreditedSince ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                Accredited {judge.accreditedSince}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

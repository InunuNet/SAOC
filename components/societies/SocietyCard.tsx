import Link from 'next/link';
import { Award } from 'lucide-react';

import type { SanityImageSource } from '@sanity/image-url';

export interface SanitySociety {
  _id: string;
  name: string;
  slug: string;
  province: string | null;
  region: string | null;
  founded: number | null;
  meets: string | null;
  venue: string | null;
  memberCount: number | null;
  description: string | null;
  logo: SanityImageSource | null;
  website: string | null;
  markBadge: boolean | null;
  /** True when `founded` is an unconfirmed estimate rather than a confirmed figure. */
  foundedPlaceholder?: boolean | null;
  /** True when `memberCount` is an unconfirmed estimate rather than a confirmed figure. */
  memberCountPlaceholder?: boolean | null;
  /** True when the society has not supplied a real meeting day/time — `meets` should be null. */
  meetPlaceholder?: boolean | null;
  /** True when the society has not supplied a real venue — `venue` should be null. */
  venuePlaceholder?: boolean | null;
}

export interface SocietyCardProps {
  society: SanitySociety;
}

export function SocietyCard({ society }: SocietyCardProps) {
  return (
    <Link
      href={`/societies/${society.slug}`}
      className="group relative flex flex-col border border-rule bg-parchment p-6 transition hover:bg-bone"
    >
      {society.markBadge === true ? (
        <span className="absolute right-5 top-5 text-muted" aria-label="Awards mark society">
          <Award size={16} aria-hidden />
        </span>
      ) : null}

      {society.province ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {society.province}
        </p>
      ) : null}

      <h3 className="mt-2 font-serif text-[20px] font-semibold leading-snug text-ink">
        {society.name}
      </h3>

      {society.region || society.founded || society.memberCount !== null ? (
        <p
          data-placeholder={
            society.foundedPlaceholder || society.memberCountPlaceholder ? 'true' : undefined
          }
          className="mt-1 font-sans text-[14px] text-ink/70"
        >
          {[
            society.region,
            society.founded ? `est. ${society.founded}` : null,
            society.memberCount !== null && society.memberCount !== undefined
              ? `${society.memberCount} members`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {society.foundedPlaceholder || society.memberCountPlaceholder ? (
            <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
              (estimated)
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Meets/venue: only rendered when the society has supplied a real value —
          no field is worth an absent-fact badge on the index grid. */}
      {society.meets || society.venue ? (
        <dl className="mt-4 space-y-1.5 text-[13px]">
          {society.meets ? (
            <div className="flex gap-2">
              <dt className="font-mono uppercase tracking-[0.12em] text-muted">Meets</dt>
              <dd className="font-sans text-ink/80">{society.meets}</dd>
            </div>
          ) : null}
          {society.venue ? (
            <div className="flex gap-2">
              <dt className="font-mono uppercase tracking-[0.12em] text-muted">Venue</dt>
              <dd className="font-sans text-ink/80">{society.venue}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <span aria-hidden className="mt-4 text-muted">
        →
      </span>
    </Link>
  );
}

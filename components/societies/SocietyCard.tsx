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

      {society.region || society.founded ? (
        <p className="mt-1 font-sans text-[14px] text-ink/70">
          {society.region}
          {society.region && society.founded ? ' · ' : ''}
          {society.founded ? `est. ${society.founded}` : ''}
        </p>
      ) : null}

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
        {society.memberCount !== null ? (
          <div className="flex gap-2">
            <dt className="font-mono uppercase tracking-[0.12em] text-muted">Members</dt>
            <dd className="font-sans text-ink/80">{society.memberCount} members</dd>
          </div>
        ) : null}
      </dl>

      <span aria-hidden className="mt-4 text-muted">
        →
      </span>
    </Link>
  );
}

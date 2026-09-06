// =============================================================
// SAOC — components/societies/SocietyDetailsCallout.tsx
// Server Component — converts a genuine data gap (no confirmed
// meeting day/venue) into a direct ask, rather than leaving it
// silent. Only rendered when the society is actually missing that
// detail. Mirrors the quiet bordered-note treatment used by the
// WOSA partnership note on the About page.
// =============================================================

import Link from 'next/link';

export interface SocietyDetailsCalloutProps {
  societyName: string;
}

export function SocietyDetailsCallout({ societyName }: SocietyDetailsCalloutProps) {
  return (
    <section className="border-t border-rule pt-10">
      <p className="max-w-2xl font-sans text-[15px] leading-relaxed text-ink/70">
        {societyName}&apos;s meeting day, time and venue are not yet confirmed on this site.
        If you&apos;re a member or committee member, help us get it right —{' '}
        <Link href="/contact" className="inline-link">
          send us the details
        </Link>{' '}
        or email the council directly at{' '}
        <a href="mailto:council@saoc.co.za" className="inline-link">
          council@saoc.co.za
        </a>
        .
      </p>
    </section>
  );
}

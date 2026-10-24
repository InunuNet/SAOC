// Suspense fallback for /societies. SocietiesClient reads useSearchParams, so the static render
// stops at this fallback: it carries every society's card (links in the server HTML) and a filters
// row that reserves the real row's height, so nothing shifts when the client mounts.
import { SocietiesGrid } from '@/components/societies';
import type { SanitySociety } from '@/components/societies';

interface SocietiesFallbackProps {
  societies: SanitySociety[];
}

export function SocietiesFallback({ societies }: SocietiesFallbackProps) {
  return (
    <div className="space-y-8">
      <div
        className="flex min-h-11 flex-wrap items-center justify-between gap-5 border-b border-rule pb-6"
        aria-hidden="true"
      />
      <SocietiesGrid societies={societies} />
    </div>
  );
}

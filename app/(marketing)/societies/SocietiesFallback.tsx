// Reserved-space Suspense fallback for /societies (launch-weekend F5): mirrors SocietiesClient's
// wrapper, filter header and card grid so the footer does not shift when the client mounts.
// Pattern from tickets/loading.tsx; existing tokens only.
interface SocietiesFallbackProps {
  // Number of cards SocietiesClient renders by default (the unfiltered societies list).
  count: number;
}

export function SocietiesFallback({ count }: SocietiesFallbackProps) {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="h-[46px] max-w-md animate-pulse border border-rule bg-bone" aria-hidden="true" />
      <div className="h-11 animate-pulse border border-rule bg-bone" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="h-[195px] lg:h-[172px] animate-pulse border border-rule bg-bone"
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="sr-only">Loading societies…</span>
    </div>
  );
}

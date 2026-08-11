// F2 (ticketing-pages) — route-level Suspense fallback while Sanity/Firestore data
// for /tickets is fetched. Sage & Paper tokens only, no new colours.
export default function TicketsLoading() {
  return (
    <div className="mx-auto max-w-[720px] px-8 py-16 space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-[480px] animate-pulse bg-bone" aria-hidden="true" />
      <div className="space-y-4 pt-4">
        <div className="h-24 animate-pulse border border-rule bg-bone" aria-hidden="true" />
        <div className="h-24 animate-pulse border border-rule bg-bone" aria-hidden="true" />
        <div className="h-24 animate-pulse border border-rule bg-bone" aria-hidden="true" />
      </div>
      <span className="sr-only">Loading ticket information…</span>
    </div>
  );
}

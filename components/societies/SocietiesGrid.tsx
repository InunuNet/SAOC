import { SocietyCard } from './SocietyCard';
import type { SanitySociety } from './SocietyCard';

export interface SocietiesGridProps {
  societies: SanitySociety[];
}

// Server-safe: shared by the client filter and the Suspense fallback, so the static HTML carries
// one link per society for a no-JS visitor or crawler.
export function SocietiesGrid({ societies }: SocietiesGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {societies.map((s) => (
        <SocietyCard key={s._id} society={s} />
      ))}
    </div>
  );
}

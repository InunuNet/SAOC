import { createClient, type SanityClient } from 'next-sanity';

import { apiVersion, dataset, projectId } from '../env';
import { withFixture } from '../../lib/sanity-fixture';
import { withCdnFallback } from './cdn-fallback';

/**
 * Sanity client.
 *
 * Returns `null` when `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset (e.g. during
 * CI build before the Sanity project is provisioned). `sanityFetch` checks
 * for null and short-circuits to graceful static fallback.
 *
 * `fetch` falls back to the API host once when the CDN is unavailable (quota exhausted,
 * rate-limited, 5xx) — see `withCdnFallback`.
 */
export const client: SanityClient | null = projectId
  ? withCdnFallback(
      withFixture(
        createClient({
          projectId,
          dataset,
          apiVersion,
          useCdn: true,
          stega: { studioUrl: '/studio' },
        })
      )
    )
  : null;

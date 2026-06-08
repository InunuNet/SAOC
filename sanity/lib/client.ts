import { createClient, type SanityClient } from 'next-sanity';

import { apiVersion, dataset, projectId } from '../env';

/**
 * Sanity client.
 *
 * Returns `null` when `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset (e.g. during
 * CI build before the Sanity project is provisioned). `sanityFetch` checks
 * for null and short-circuits to graceful static fallback.
 */
export const client: SanityClient | null = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      stega: { studioUrl: '/studio' },
    })
  : null;

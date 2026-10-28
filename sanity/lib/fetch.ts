import { draftMode } from 'next/headers';

import { SanityFixtureMiss } from '../../lib/sanity-fixture';
import { client } from './client';

// Matches every page's `export const revalidate = 60`: a published read is reused from the data
// cache for this long instead of hitting Sanity on every render. Tag webhooks
// (app/api/revalidate) still refresh it immediately.
export const SANITY_REVALIDATE_SECONDS = 60;

const DEFAULT_TAGS = ['sanity'];

export type SanityFetchRequestOptions = {
  useCdn: boolean;
  perspective: 'previewDrafts' | 'published';
  cache?: 'no-store';
  next: { revalidate?: number; tags: string[] };
};

// Pure: the Sanity client options for one read. Draft and `live` reads bypass the data cache
// (no-store, no revalidate); a normal published read joins it for SANITY_REVALIDATE_SECONDS.
export function buildSanityFetchOptions({
  isDraft,
  live,
  tags,
}: {
  isDraft: boolean;
  live?: boolean;
  tags?: string[] | null;
}): SanityFetchRequestOptions {
  const resolvedTags = tags ?? DEFAULT_TAGS;
  const base = {
    perspective: isDraft ? ('previewDrafts' as const) : ('published' as const),
    useCdn: !isDraft,
  };
  if (isDraft || live) {
    return { ...base, cache: 'no-store', next: { tags: resolvedTags } };
  }
  return { ...base, next: { revalidate: SANITY_REVALIDATE_SECONDS, tags: resolvedTags } };
}

type SanityFetchOptions = {
  query: string;
  params?: Record<string, unknown>;
  tags?: string[];
  /** When true the read is never cached (price and sales-state reads on the buy path). */
  live?: boolean;
  /** When true, a missing client or a failed fetch throws instead of resolving to
   * `null`. Default (unset/false) preserves the historical graceful-degradation
   * behavior relied on by most callers. */
  propagateErrors?: boolean;
};

export async function sanityFetch<T>({
  query,
  params,
  tags,
  live,
  propagateErrors,
}: SanityFetchOptions): Promise<T | null> {
  if (!client) {
    if (propagateErrors) {
      throw new Error('[sanityFetch] Sanity client is not configured (missing env vars)');
    }
    return null;
  }

  let isEnabled = false;
  try {
    const draft = await draftMode();
    isEnabled = draft.isEnabled;
  } catch {
    // Outside a request context (e.g. generateStaticParams) — default to published
  }

  try {
    return await client.fetch<T>(
      query,
      params ?? {},
      buildSanityFetchOptions({ isDraft: isEnabled, live, tags }),
    );
  } catch (error) {
    console.error('[sanityFetch] failed', { query, error });
    // A replay miss is a gate failure, never a reason to render fallback content.
    if (error instanceof SanityFixtureMiss) {
      throw error;
    }
    if (propagateErrors) {
      throw error;
    }
    return null;
  }
}

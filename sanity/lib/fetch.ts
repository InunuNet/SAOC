import { draftMode } from 'next/headers';

import { client } from './client';

type SanityFetchOptions = {
  query: string;
  params?: Record<string, unknown>;
  tags?: string[];
  /** When true, a missing client or a failed fetch throws instead of resolving to
   * `null`. Default (unset/false) preserves the historical graceful-degradation
   * behavior relied on by most callers. */
  propagateErrors?: boolean;
};

export async function sanityFetch<T>({
  query,
  params,
  tags,
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
    return await client.fetch<T>(query, params ?? {}, {
      next: { tags: tags ?? ['sanity'] },
      perspective: isEnabled ? 'previewDrafts' : 'published',
      useCdn: !isEnabled,
    });
  } catch (error) {
    console.error('[sanityFetch] failed', { query, error });
    if (propagateErrors) {
      throw error;
    }
    return null;
  }
}

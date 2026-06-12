import { draftMode } from 'next/headers';

import { client } from './client';

type SanityFetchOptions = {
  query: string;
  params?: Record<string, unknown>;
  tags?: string[];
};

export async function sanityFetch<T>({
  query,
  params,
  tags,
}: SanityFetchOptions): Promise<T | null> {
  if (!client) {
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
    return null;
  }
}

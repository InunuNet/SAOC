import { createClient } from 'next-sanity';

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
export const apiVersion = '2024-10-01';

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  // useCdn false in dev / preview for fresh content; true in production for speed.
  useCdn: process.env.NODE_ENV === 'production',
});

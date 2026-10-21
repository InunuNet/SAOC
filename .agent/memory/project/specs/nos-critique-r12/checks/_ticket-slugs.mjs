// nos-critique-r12: every ticket slug /tickets/<slug> resolves, read from Sanity with the same filter as ticketTypeBySlugQuery
// (sanity/queries.ts: _type == "ticketType" && active == true), so F4's ticket list is exhaustive rather than the hub's sample (QA input, hash-locked).
// Uses the worktree's own next-sanity client and its public project id / dataset (sanity/env.ts defaults; .env.local overrides).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from './_lib.mjs';
import { require } from './_server.mjs';

const QUERY = '*[_type == "ticketType" && active == true && defined(slug.current)] | order(slug.current asc).slug.current';

export async function resolvableTicketSlugs() {
  const envFile = path.join(repoRoot, '.env.local');
  if (existsSync(envFile)) require('dotenv').config({ path: envFile, quiet: true });
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) throw new Error('INFRA: NEXT_PUBLIC_SANITY_PROJECT_ID is not set in the worktree environment');
  const { createClient } = await import(pathToFileURL(require.resolve('next-sanity')).href);
  const client = createClient({ projectId, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production', apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-10-01', useCdn: false });
  const slugs = await client.fetch(QUERY);
  if (!Array.isArray(slugs) || slugs.length === 0) throw new Error('INFRA: Sanity returned no active ticket types');
  return slugs;
}

// F5 (cms-activation-deploy): shared Sanity client bootstrap for the f5-event-slugs
// checks — identical credential-loading pattern to f3-pin-singletons and
// f4-seed-page-singletons (never dotenv-banner-to-stdout, .env.local only, hard fail
// never skip on missing credentials).

import { createClient } from '@sanity/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

export function getClientOrFail() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

  if (!projectId || !dataset || !token) {
    console.error(
      'FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local'
    );
    process.exit(1);
  }

  return createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });
}

export async function fetchAllEvents(client) {
  try {
    return await client.fetch(
      `*[_type == "societyEvent"]{_id, title, date, "slug": slug.current}`
    );
  } catch (err) {
    console.error(`FAIL: GROQ query for societyEvent documents threw — ${err.message}`);
    process.exit(1);
  }
}

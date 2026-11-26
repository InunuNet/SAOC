/**
 * One-off, non-destructive patch (26 Nov 2026): align two live Sanity fields with the master
 * Refund and Cancellation Policy (content/legal/refunds.ts):
 *   - showFaq-q15 answer (kept in sync with scripts/seed-show-faq.ts question 15)
 *   - ticketsPage.termsNote (the master transfer rule; kept in sync with scripts/seed-ticketing.ts)
 * Only those two fields are set; nothing else on either document is touched. Safe to re-run.
 *
 * Env: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN, read from
 * the file named by SAOC_ENV_FILE (default ./.env.local). Values are never printed.
 *
 * Run: node --import tsx/esm scripts/patch-legal-master-copy.ts [--apply]
 * A bare run is a dry run: it reads the current values and writes nothing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const FAQ_ID = 'showFaq-q15';
const TICKETS_PAGE_ID = 'ticketsPage';
const FAQ_PARAGRAPHS: readonly string[] = [
  'Conference tickets are named-registrant products and follow the same cancellation schedule above. ' +
    'A conference ticket may be transferred as set out under Transferring your ticket. ' +
    'The full name of the new registrant is required.',
  'The full policy is at https://nos.saoc.co.za/refunds',
];
const TERMS_NOTE =
  'As an alternative to cancelling, you may transfer your ticket to another person, free of charge, ' +
  'up to 7 days before the event. To do so, contact SAOC with your booking reference and the full ' +
  'name and email address of the new ticket holder. SAOC will cancel the original ticket and its QR ' +
  'code and issue a new ticket to the new holder. Please do not give the new holder a copy of the ' +
  'original ticket, because its QR code will no longer work.';

const DRY_RUN = !process.argv.includes('--apply');

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.env.SAOC_ENV_FILE ?? path.join(process.cwd(), '.env.local'));
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function faqBlocks() {
  return FAQ_PARAGRAPHS.map((text, index) => ({
    _type: 'block',
    _key: `${FAQ_ID}-b${index}`,
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: `${FAQ_ID}-s${index}`, text, marks: [] }],
  }));
}

async function main() {
  const env = loadEnv();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;
  if (!projectId || !dataset || !token) {
    throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_TOKEN');
  }
  const client = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });

  const faqBefore = await client.fetch<{ answer?: Array<{ children?: Array<{ text?: string }> }> } | null>(
    `*[_id == $id][0]{answer}`, { id: FAQ_ID });
  const noteBefore = await client.fetch<string | null>(`*[_id == $id][0].termsNote`, { id: TICKETS_PAGE_ID });
  if (!faqBefore) throw new Error(`${FAQ_ID} does not exist; nothing to patch`);
  console.log('FAQ before:', JSON.stringify(faqBefore.answer?.map((b) => b.children?.[0]?.text)));
  console.log('termsNote before:', noteBefore);

  if (DRY_RUN) {
    console.log('Dry run, pass --apply to write.');
    return;
  }
  await client.patch(FAQ_ID).set({ answer: faqBlocks() }).commit({ autoGenerateArrayKeys: false });
  if (noteBefore !== null) {
    await client.patch(TICKETS_PAGE_ID).set({ termsNote: TERMS_NOTE }).commit();
  } else {
    console.log('ticketsPage.termsNote not set on the live document; left alone.');
  }

  const faqAfter = await client.fetch<string[]>(
    `*[_id == $id][0].answer[].children[0].text`, { id: FAQ_ID });
  const noteAfter = await client.fetch<string | null>(`*[_id == $id][0].termsNote`, { id: TICKETS_PAGE_ID });
  const faqOk = JSON.stringify(faqAfter) === JSON.stringify(FAQ_PARAGRAPHS);
  const noteOk = noteBefore === null || noteAfter === TERMS_NOTE;
  console.log(`read-back: faq ${faqOk ? 'OK' : 'MISMATCH'}, termsNote ${noteOk ? 'OK' : 'MISMATCH'}`);
  if (!faqOk || !noteOk) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * SAOC Sanity Seed Script
 *
 * Imports typed data arrays from lib/data and upserts them into the
 * configured Sanity dataset using deterministic IDs + createOrReplace.
 *
 * Run with: pnpm seed
 *
 * Required env:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID — Sanity project id
 *   NEXT_PUBLIC_SANITY_DATASET    — Sanity dataset name (e.g. "production")
 *   SANITY_API_TOKEN              — write-enabled Sanity API token
 */

import { config } from 'dotenv';
import { createClient } from '@sanity/client';

config({ quiet: true });

import {
  awards,
  BOARD_PLACEHOLDER_NAME,
  boardMembers,
  events,
  partners,
  provinces,
  showClasses,
  shows,
  societies,
} from '../lib/data';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function safeid(type: string, key: string): string {
  const normalized = slugify(key);
  return `${type}-${normalized}`;
}

// ---------------------------------------------------------------------------
// Mappers — each returns docs ready for createOrReplace
// ---------------------------------------------------------------------------

function mapAwards(): Record<string, unknown>[] {
  return awards.map((a) => ({
    _id: safeid('award', a.code),
    _type: 'award',
    code: a.code,
    name: a.name,
    description: a.description,
  }));
}

function mapBoardMembers(): Record<string, unknown>[] {
  // Keyed on role, not `${name}-${role}`: a placeholder name ("To be confirmed") is
  // expected to be corrected in place once SAOC supplies the real officeholder, and
  // an id derived from the name would mint a NEW document on that edit — leaving the
  // old placeholder-named document behind as an orphaned duplicate committee member.
  // Roles are the stable identity here; names are the field expected to change.
  return boardMembers.map((m) => ({
    _id: safeid('boardMember', m.role),
    _type: 'boardMember',
    name: m.name,
    role: m.role,
    // Derived from the sentinel, not hardcoded — flips to false automatically once
    // lib/data/board.ts is updated with the real name, no separate flag to maintain.
    placeholder: m.name === BOARD_PLACEHOLDER_NAME,
  }));
}

function mapEvents(): Record<string, unknown>[] {
  return events.map((e) => ({
    _id: safeid('societyEvent', `${e.id}-${slugify(e.title)}`),
    _type: 'societyEvent',
    title: e.title,
    date: e.date,
    ...(e.endDate ? { endDate: e.endDate } : {}),
    kind: e.kind,
    venue: e.venue,
  }));
}

function mapProvinces(): Record<string, unknown>[] {
  // `order` mirrors the curated array position (ALL excluded) so a fresh seed
  // reproduces the /societies chip sequence rather than an alphabetical one.
  return provinces
    .filter((p) => p.code !== 'ALL')
    .map((p, index) => ({
      _id: safeid('province', p.code),
      _type: 'province',
      name: p.name,
      code: p.code,
      slug: { _type: 'slug', current: slugify(p.code) },
      order: index + 1,
    }));
}

function mapSocieties(): Record<string, unknown>[] {
  return societies.map((s) => ({
    _id: safeid('society', s.name),
    _type: 'society',
    name: s.name,
    slug: { _type: 'slug', current: slugify(s.name) },
    province: s.province,
    region: s.region,
    founded: s.founded,
    memberCount: s.members,
    // The whole static societies array is our own estimate, not sourced from
    // Lee-Ann or the affiliated societies themselves — see lib/data/societies.ts.
    foundedPlaceholder: true,
    memberCountPlaceholder: true,
    // meet/venue are omitted from lib/data/societies.ts entirely rather than
    // filled with an invented schedule/location (a wrong meeting time or venue
    // is actionable, not just inaccurate). createOrReplace means an omitted key
    // here clears any previously-seeded value on re-seed, same as a live unset.
    ...(s.meet !== undefined ? { meets: s.meet } : {}),
    ...(s.venue !== undefined ? { venue: s.venue } : {}),
    meetPlaceholder: s.meet === undefined,
    venuePlaceholder: s.venue === undefined,
  }));
}

function mapShows(): Record<string, unknown>[] {
  return shows.map((sh) => {
    const title = `National Show ${sh.edition} (${sh.year})`;
    return {
      _id: safeid('show', `${sh.edition}-${sh.year}`),
      _type: 'show',
      title,
      year: sh.year,
      location: sh.venue,
      status: sh.status,
      ...(typeof sh.entries === 'number' ? { entries: sh.entries } : {}),
      slug: { _type: 'slug', current: slugify(title) },
    };
  });
}

function mapShowClasses(): Record<string, unknown>[] {
  return showClasses.map((c) => ({
    _id: safeid('showClass', c.code),
    _type: 'showClass',
    code: c.code,
    name: c.name,
    description: c.description,
  }));
}

function mapPartners(): Record<string, unknown>[] {
  return partners.map((p) => ({
    _id: safeid('sponsor', p.name),
    _type: 'sponsor',
    name: p.name,
  }));
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function seedBatch(label: string, docs: Record<string, unknown>[]): Promise<void> {
  if (docs.length === 0) {
    console.log(`  ${label}: 0 docs (skipped)`);
    return;
  }
  let tx = client.transaction();
  for (const doc of docs) {
    tx = tx.createOrReplace(doc as { _id: string; _type: string });
  }
  await tx.commit();
  console.log(`  ${label}: ${docs.length} docs upserted`);
}

async function main(): Promise<void> {
  console.log(`Seeding Sanity dataset "${dataset}" (project ${projectId})`);

  await seedBatch('awards', mapAwards());
  await seedBatch('boardMembers', mapBoardMembers());
  await seedBatch('provinces', mapProvinces());
  await seedBatch('societies', mapSocieties());
  await seedBatch('events', mapEvents());
  await seedBatch('shows', mapShows());
  await seedBatch('showClasses', mapShowClasses());
  await seedBatch('partners (→ sponsor)', mapPartners());

  console.log('Seed complete.');
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

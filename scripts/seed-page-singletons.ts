/**
 * F4 (cms-activation-deploy) — Seed the six page-singleton documents.
 *
 * Migrates copy VERBATIM from the hardcoded fallbacks already present in
 * app/(marketing)/ and components/ into the six pinned Sanity singleton
 * documents (F3's desk-structure pinning: _id === schema type name). Every
 * field value written here traces to
 * contracts/golden/f4-seed-page-singletons/*.golden.json — do not add,
 * rewrite, or "improve" any field without updating the golden first.
 *
 * Fields the goldens mark "absent" are deliberately left unset — they are
 * documented gaps (dead schema fields, or code with no hardcoded fallback to
 * migrate from), not missed work. See the golden files' `note` per field.
 *
 * Idempotent: uses createOrReplace against the pinned _id (never creates a
 * second document of the same type), and reuses already-uploaded image
 * assets on re-run instead of uploading duplicates.
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package
 * — its startup banner writes to stdout and has corrupted an env value
 * before on this project):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-page-singletons.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { createClient, type SanityClient } from '@sanity/client';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
// ---------------------------------------------------------------------------

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnvLocal();
const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
const token = env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function block(text: string) {
  return [
    {
      _type: 'block',
      _key: randomUUID(),
      style: 'normal',
      markDefs: [],
      children: [{ _type: 'span', _key: randomUUID(), text, marks: [] }],
    },
  ];
}

function isWellFormedImageRef(img: unknown): img is { _type: string; asset: { _ref: string } } {
  return (
    !!img &&
    typeof img === 'object' &&
    (img as { _type?: unknown })._type === 'image' &&
    typeof (img as { asset?: { _ref?: unknown } }).asset?._ref === 'string' &&
    /^image-/.test((img as { asset: { _ref: string } }).asset._ref)
  );
}

/** Upload a public/images/ file as a Sanity image asset, returning an image field value. */
async function uploadImage(relPath: string) {
  const filePath = path.resolve(process.cwd(), 'public', 'images', relPath);
  const buffer = readFileSync(filePath);
  const asset = await client.assets.upload('image', buffer, { filename: relPath });
  return {
    _type: 'image' as const,
    _key: randomUUID(),
    asset: { _type: 'reference' as const, _ref: asset._id },
  };
}

/** Reuse an existing single image field if it's already well-formed; else upload fresh. */
async function imageFieldOrReuse(
  existing: unknown,
  relPath: string,
): Promise<{ _type: 'image'; asset: { _type: 'reference'; _ref: string } }> {
  if (isWellFormedImageRef(existing)) {
    console.log(`    reusing existing image asset for ${relPath} (${existing.asset._ref})`);
    return existing as { _type: 'image'; asset: { _type: 'reference'; _ref: string } };
  }
  console.log(`    uploading ${relPath}`);
  return uploadImage(relPath);
}

/** Reuse an existing image array if every item is already well-formed; else upload fresh. */
async function imageArrayFieldOrReuse(
  existing: unknown,
  relPaths: string[],
): Promise<{ _type: 'image'; asset: { _type: 'reference'; _ref: string } }[]> {
  if (
    Array.isArray(existing) &&
    existing.length >= relPaths.length &&
    existing.every(isWellFormedImageRef)
  ) {
    console.log(`    reusing ${existing.length} existing hero image asset(s)`);
    return (existing as Record<string, unknown>[]).map((item) => ({
      ...item,
      _key: typeof item._key === 'string' && item._key.length > 0 ? item._key : randomUUID(),
      // Cast via unknown: `item` is a validated well-formed image ref widened to a plain
      // record above, so the spread loses the specific shape TS can statically verify.
    })) as unknown as { _type: 'image'; asset: { _type: 'reference'; _ref: string } }[];
  }
  console.log(`    uploading ${relPaths.length} hero image(s)`);
  const uploaded = [];
  for (const relPath of relPaths) {
    uploaded.push(await uploadImage(relPath));
  }
  return uploaded;
}

async function fetchExisting(id: string): Promise<Record<string, unknown> | null> {
  return client.fetch(`*[_id == $id][0]`, { id });
}

// ---------------------------------------------------------------------------
// Per-document seed builders — every value below traces to a golden file in
// contracts/golden/f4-seed-page-singletons/. Fields not set here are the
// documented "absent" gaps from those goldens.
// ---------------------------------------------------------------------------

async function seedHomePage(): Promise<void> {
  console.log('  homePage:');
  const existing = await fetchExisting('homePage');
  const heroImages = await imageArrayFieldOrReuse(existing?.heroImages, [
    'orchid-yellow.jpg',
    'orchid-violet.jpg',
    'orchid-pink.jpg',
    'orchid-dark.jpg',
  ]);

  await client.createOrReplace({
    _id: 'homePage',
    _type: 'homePage',
    title: 'South African Orchid Council',
    missionText:
      'SAOC exists to promote the culture, hybridisation and appreciation of orchids across South Africa. We do this through a federated network of 21 societies, a nationally accredited judging system first standardised in 1990, and our annual publication Orchids South Africa.',
    heroImages,
    // countdownDate: absent — dead field, no component reads it (golden gap).
  });
  console.log('    seeded title, missionText, heroImages (countdownDate left absent)');
}

async function seedAboutPage(): Promise<void> {
  console.log('  aboutPage:');
  await client.createOrReplace({
    _id: 'aboutPage',
    _type: 'aboutPage',
    // title: absent — never read, no hardcoded analog (golden gap).
    pillars: block(
      'SAOC has coordinated orchid cultivation across South Africa since 1968 — uniting affiliated societies in growing, showing, hybridising, and judging.',
    ),
    timelineNodes: block(
      'Founded in 1968, the Council has grown to coordinate orchid societies nationwide.',
    ),
    // boardIntroText: absent — no fallback string to migrate, legitimately empty.
  });
  console.log('    seeded pillars, timelineNodes (title, boardIntroText left absent)');
}

async function seedNationalShow(): Promise<void> {
  console.log('  nationalShow:');
  const existing = await fetchExisting('nationalShow');
  const hero = await imageFieldOrReuse(existing?.hero, 'orchid-yellow.jpg');

  await client.createOrReplace({
    _id: 'nationalShow',
    _type: 'nationalShow',
    title: 'The 19th South African National Orchid Show',
    // showDate: absent — only a non-parseable display string exists (golden gap).
    location: 'Cape Town International Convention Centre',
    hero,
    countdownDate: '2027-09-18T09:00:00+02:00',
    // exhibitorStages: absent — no hardcoded copy to migrate (golden gap).
  });
  console.log(
    '    seeded title, location, hero, countdownDate (showDate, exhibitorStages left absent)',
  );
}

async function seedContactPage(): Promise<void> {
  console.log('  contactPage:');
  await client.createOrReplace({
    _id: 'contactPage',
    _type: 'contactPage',
    title: 'Contact SAOC',
    directContacts: [
      {
        _key: randomUUID(),
        name: 'SAOC Secretariat',
        role: 'General enquiries',
        email: 'info@saoc.co.za',
      },
    ],
    // formRecipients: absent — orphaned field, no hardcoded value (golden gap).
  });
  console.log('    seeded title, directContacts (formRecipients left absent)');
}

async function seedJudgingPage(): Promise<void> {
  console.log('  judgingPage:');
  await client.createOrReplace({
    _id: 'judgingPage',
    _type: 'judgingPage',
    title: 'Judging at SAOC',
    intro: block(
      'SAOC operates a national orchid judging system — training and accrediting judges who score plants on form, colour, size, and cultural condition at affiliated shows.',
    ),
    howItWorks: block(
      'Plants are assessed by accredited judging panels against published criteria. Awards are conferred when a plant meets the required point threshold.',
    ),
    // stats: absent — explicitly conditional, no hardcoded fallback numbers.
    becomingAJudge: block(
      'Judging accreditation is earned through a structured training programme run by SAOC. Speak to your affiliated society to begin the pathway.',
    ),
    // judges: absent — 0 judge documents exist to reference.
    showPublicDirectory: false,
  });
  console.log(
    '    seeded title, intro, howItWorks, becomingAJudge, showPublicDirectory (stats, judges left absent)',
  );
}

async function seedMembersPage(): Promise<void> {
  console.log('  membersPage:');
  // Brad's decision (2026-07-29): document must exist with zero content.
  await client.createOrReplace({
    _id: 'membersPage',
    _type: 'membersPage',
  });
  console.log('    seeded as empty placeholder (title, intro, resources left absent per decision)');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Seeding page singletons in Sanity dataset "${dataset}" (project ${projectId})`);
  await seedHomePage();
  await seedAboutPage();
  await seedNationalShow();
  await seedContactPage();
  await seedJudgingPage();
  await seedMembersPage();
  console.log('Seed complete.');
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

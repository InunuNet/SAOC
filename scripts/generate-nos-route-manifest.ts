#!/usr/bin/env node
// scripts/generate-nos-route-manifest.ts
//
// Generates content/national-show-routes.json — the artifact the saoc-eb lane builds
// its header from WITHOUT reading our code. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest-schema.golden.md.
//
// A hand-maintained manifest drifts silently; this script is the single source that
// writes it. It walks app/(marketing)/national-show/ for page.tsx files (so a route
// that does not exist on disk cannot appear, and a route that exists but is not listed
// here is caught by RM1's disk->manifest direction at gate time) and joins the result
// against ROUTE_TABLE, the metadata Brad's approved tree assigns each row — label,
// group, purpose, owner, archetype, pageKey, specNumber — which cannot be recovered
// from the filesystem alone.
//
// Run: node_modules/.bin/tsx scripts/generate-nos-route-manifest.ts

import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const NOS_APP_DIR = path.join(PROJECT_ROOT, 'app', '(marketing)', 'national-show');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'content', 'national-show-routes.json');

type Owner = 'nos-design' | 'saoc-eb';
type Status = 'created' | 'reconciled' | 'restructured' | 'untouched';
type Archetype = 'hub' | 'prose' | 'schedule' | 'listing' | 'transactional' | 'archive';

interface RouteRow {
  slug: string;
  label: string;
  group: string | null;
  parent: string | null;
  order: number;
  listed: boolean;
  dynamic: boolean;
  indexable: boolean;
  status: Status;
  owner: Owner;
  archetype: Archetype;
  purpose: string;
  pageKey: string | null;
  specNumber: number | null;
  /** Directory to check for a page.tsx, relative to NOS_APP_DIR. Not part of the schema. */
  diskPath: string;
}

// The 21 rows. Brad's approved 17-page tree —
// goldens/m4/route-manifest.golden.md / route-manifest-schema.golden.md §"The 21 rows".
const ROUTE_TABLE: RouteRow[] = [
  {
    slug: '/national-show',
    label: 'National Show',
    group: null,
    parent: null,
    order: 1,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'restructured',
    owner: 'nos-design',
    archetype: 'hub',
    purpose: 'The National Show subsection landing page and its entire primary navigation.',
    pageKey: '01-national-show-landing',
    specNumber: 1,
    diskPath: '.',
  },
  {
    slug: '/national-show/about',
    label: 'About the Show',
    group: 'visit',
    parent: '/national-show',
    order: 1,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'reconciled',
    owner: 'nos-design',
    archetype: 'prose',
    purpose: "The show's theme, what it brings together, and who takes part.",
    pageKey: '02-about-the-national-show',
    specNumber: 2,
    diskPath: 'about',
  },
  {
    slug: '/national-show/what-to-expect',
    label: 'What to Expect',
    group: 'visit',
    parent: '/national-show',
    order: 2,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'reconciled',
    owner: 'nos-design',
    archetype: 'prose',
    purpose: 'Hours, admission and on-the-day detail for visitors.',
    pageKey: '03-what-to-expect',
    specNumber: 3,
    diskPath: 'what-to-expect',
  },
  {
    slug: '/national-show/plan-your-visit',
    label: 'Plan Your Visit',
    group: 'visit',
    parent: '/national-show',
    order: 3,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'reconciled',
    owner: 'nos-design',
    archetype: 'prose',
    purpose: 'Travel, parking, accommodation and nearby attractions.',
    pageKey: '16-plan-your-visit',
    specNumber: 16,
    diskPath: 'plan-your-visit',
  },
  {
    slug: '/national-show/faq',
    label: 'FAQ',
    group: 'visit',
    parent: '/national-show',
    order: 4,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'reconciled',
    owner: 'nos-design',
    archetype: 'prose',
    purpose: 'The questions visitors ask us most.',
    pageKey: '17-faq',
    specNumber: 17,
    diskPath: 'faq',
  },
  {
    slug: '/national-show/programme',
    label: 'Programme',
    group: 'programme',
    parent: '/national-show',
    order: 1,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'created',
    owner: 'nos-design',
    archetype: 'schedule',
    purpose: 'The overall schedule of sessions across the four show days.',
    pageKey: '11-programme',
    specNumber: 11,
    diskPath: 'programme',
  },
  {
    slug: '/national-show/workshops',
    label: 'Workshops',
    group: 'programme',
    parent: '/national-show',
    order: 2,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'reconciled',
    owner: 'nos-design',
    archetype: 'schedule',
    purpose: 'Book Sunset Cocktails and guided Field Trip outings.',
    pageKey: '12-workshops',
    specNumber: 12,
    diskPath: 'workshops',
  },
  {
    slug: '/national-show/symposium',
    label: 'SAOC Symposium',
    group: 'programme',
    parent: '/national-show',
    order: 3,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'created',
    owner: 'nos-design',
    archetype: 'prose',
    purpose: "The SAOC Symposium — what it is, its theme, and who it is for.",
    pageKey: '06-saoc-symposium',
    specNumber: 6,
    diskPath: 'symposium',
  },
  {
    slug: '/national-show/wosa-conference',
    label: 'WOSA Conference',
    group: 'programme',
    parent: '/national-show',
    order: 4,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'created',
    owner: 'nos-design',
    archetype: 'prose',
    purpose:
      'What the WOSA Conference is and who it is for, with a link out to WOSA for wild-orchid content.',
    pageKey: '07-wosa-conference',
    specNumber: 7,
    diskPath: 'wosa-conference',
  },
  {
    slug: '/national-show/conferences',
    label: 'Conference Registration',
    group: 'programme',
    parent: '/national-show',
    order: 5,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'transactional',
    purpose: 'Register for the Symposium and WOSA Conference.',
    pageKey: null,
    specNumber: null,
    diskPath: 'conferences',
  },
  {
    slug: '/national-show/sa-exhibitors',
    label: 'South African Exhibitors',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 1,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'created',
    owner: 'nos-design',
    archetype: 'listing',
    purpose: 'Public directory of South African nurseries exhibiting at the show.',
    pageKey: '04-south-african-exhibitors',
    specNumber: 4,
    diskPath: 'sa-exhibitors',
  },
  {
    slug: '/national-show/international-guests',
    label: 'International Guests',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 2,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'created',
    owner: 'nos-design',
    archetype: 'listing',
    purpose: 'Public directory of international guests and exhibitors attending the show.',
    pageKey: '05-international-guests-and-exhibitors',
    specNumber: 5,
    diskPath: 'international-guests',
  },
  {
    slug: '/national-show/exhibitors',
    label: 'Exhibitor Entry Guide',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 3,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'prose',
    purpose: 'Entry process, fees, classes, judging and eligibility for growers entering plants.',
    pageKey: null,
    specNumber: null,
    diskPath: 'exhibitors',
  },
  {
    slug: '/national-show/vendors',
    label: 'Trade Vendors',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 4,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'transactional',
    purpose: 'Trade vendor showcase, application and gated registration.',
    pageKey: null,
    specNumber: null,
    diskPath: 'vendors',
  },
  {
    slug: '/national-show/tickets',
    label: 'Tickets',
    group: 'the-show',
    parent: '/national-show',
    order: 1,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'transactional',
    purpose: 'Buy admission tickets.',
    pageKey: null,
    specNumber: null,
    diskPath: 'tickets',
  },
  {
    slug: '/national-show/sponsors',
    label: 'Show Sponsors',
    group: 'the-show',
    parent: '/national-show',
    order: 2,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'created',
    owner: 'nos-design',
    archetype: 'listing',
    purpose: "The Show's own sponsors — a separate list from SAOC's site-level sponsors.",
    pageKey: '15-sponsors',
    specNumber: 15,
    diskPath: 'sponsors',
  },
  {
    slug: '/national-show/archive',
    label: 'Past Shows',
    group: 'the-show',
    parent: '/national-show',
    order: 3,
    listed: true,
    dynamic: false,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'archive',
    purpose: 'Previous editions and their champions.',
    pageKey: null,
    specNumber: null,
    diskPath: 'archive',
  },
  // Unlisted sub-routes — exist on disk, not header entries.
  {
    slug: '/national-show/vendors/apply',
    label: 'Vendor Application',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 5,
    listed: false,
    dynamic: false,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'transactional',
    purpose: 'Public vendor application form.',
    pageKey: null,
    specNumber: null,
    diskPath: 'vendors/apply',
  },
  {
    slug: '/national-show/vendors/register',
    label: 'Vendor Registration',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 6,
    listed: false,
    dynamic: false,
    indexable: false,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'transactional',
    purpose: 'Token-gated full vendor registration form.',
    pageKey: null,
    specNumber: null,
    diskPath: 'vendors/register',
  },
  {
    slug: '/national-show/vendors/payment',
    label: 'Vendor Payment',
    group: 'exhibit-trade',
    parent: '/national-show',
    order: 7,
    listed: false,
    dynamic: false,
    indexable: false,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'transactional',
    purpose: 'Vendor stand-booking payment.',
    pageKey: null,
    specNumber: null,
    diskPath: 'vendors/payment',
  },
  {
    slug: '/national-show/archive/[year]',
    label: 'Past Show — Year',
    group: 'the-show',
    parent: '/national-show',
    order: 4,
    listed: false,
    dynamic: true,
    indexable: true,
    status: 'untouched',
    owner: 'saoc-eb',
    archetype: 'archive',
    purpose: 'A single past edition, by year.',
    pageKey: null,
    specNumber: null,
    diskPath: 'archive/[year]',
  },
];

function assertOnDisk(rows: RouteRow[]): void {
  const missing: string[] = [];
  for (const row of rows) {
    const pagePath = path.join(NOS_APP_DIR, row.diskPath, 'page.tsx');
    if (!existsSync(pagePath)) missing.push(`${row.slug} -> ${pagePath}`);
  }
  if (missing.length > 0) {
    throw new Error(
      `generate-nos-route-manifest: ${missing.length} manifest row(s) have no page.tsx on ` +
        `disk. A manifest row with no page is a dead link the saoc-eb lane will ship:\n` +
        missing.join('\n'),
    );
  }
}

function main(): void {
  assertOnDisk(ROUTE_TABLE);

  const routes = ROUTE_TABLE.map((row) => {
    const { diskPath, ...manifestRow } = row;
    void diskPath;
    return manifestRow;
  });

  const manifest = {
    schema: 'saoc.nos-route-manifest/v1',
    generatedFor: 'national-show-ia-alignment M4',
    generatedAt: '2026-09-10',
    groups: [
      { id: 'visit', label: 'Visit', order: 1 },
      { id: 'programme', label: 'Programme', order: 2 },
      { id: 'exhibit-trade', label: 'Exhibit & Trade', order: 3 },
      { id: 'the-show', label: 'The Show', order: 4 },
    ],
    routes,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${routes.length} routes to ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main();

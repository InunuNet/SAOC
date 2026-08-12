/**
 * F1 (show-exhibitor-info) — Seed the exhibitor guide behind /national-show/exhibitors:
 * the showExhibitorInfo copy singleton and the seven showExhibitorStep documents.
 *
 * THE ONE RULE THIS SCRIPT EXISTS UNDER
 * Never state a rule as SAOC policy that SAOC has not confirmed. Every block below is
 * either researched international show practice offered for the show committee to
 * CORRECT, an honest placeholder for a value only SAOC can give, or an open question the
 * research looked for and could not find. Nothing is seeded as committee-confirmed fact.
 * An exhibitor turned away at staging because this page invented a deadline has been
 * harmed by us, so the copy hedges on purpose — do not tighten it.
 *
 * Every block traces to a numbered finding in
 * `.agent/memory/project/show-exhibitor-conventions.md`; the mapping is
 * `contracts/golden/show-exhibitor-info/research-to-copy-map.golden.md`.
 *
 * A NEW script on purpose. scripts/seed-page-singletons.ts is known-hazardous: it
 * force-replaces documents with hardcoded literals, so re-running it silently reverts
 * whatever an editor changed in Studio. Nothing here uses that pattern and nothing here
 * touches that file.
 *
 *   - createIfNotExists on deterministic _ids, so a second run collides with the existing
 *     document rather than creating a duplicate.
 *   - setIfMissing for every field, so an editor's correction always wins over the seed.
 *   - Sanity assigns a fresh _rev to any document a committed transaction touches, even
 *     when the mutation changes nothing. So idempotence needs the write to be SKIPPED,
 *     not merely made harmless: each document is read first and only genuinely-absent
 *     fields are patched.
 *   - Portable-text _key values are derived from the block slug and its index, never
 *     random: a random key changes the document on every run and defeats idempotence.
 *   - Nothing here writes the legacy portable-text exhibitor blob on nationalShow that
 *     showExhibitorStep retires, and nothing here uploads or links an entry form. There
 *     is no entry form yet; seeding a placeholder one would be the exact harm this
 *     mission exists to prevent.
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package — its banner
 * writes to stdout and has corrupted captured values on this project before):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: pnpm seed:exhibitor
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

// ---------------------------------------------------------------------------
// Env
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
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
      'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

const EXHIBITOR_INFO_ID = 'showExhibitorInfo';

// ---------------------------------------------------------------------------
// Portable text — deterministic keys, derived from the block slug and index.
// ---------------------------------------------------------------------------

interface TextRun {
  text: string;
  strong?: boolean;
}

interface PortableSpan {
  _type: 'span';
  _key: string;
  text: string;
  marks: string[];
}

interface PortableBlock {
  _type: 'block';
  _key: string;
  style: 'normal';
  markDefs: never[];
  children: PortableSpan[];
}

/** One paragraph is either a plain string or a sequence of runs, some emphasised. */
type Paragraph = string | TextRun[];

function toRuns(paragraph: Paragraph): TextRun[] {
  return typeof paragraph === 'string' ? [{ text: paragraph }] : paragraph;
}

function portableText(slug: string, paragraphs: Paragraph[]): PortableBlock[] {
  return paragraphs.map((paragraph, index) => ({
    _type: 'block',
    _key: `${slug}-${index}`,
    style: 'normal',
    markDefs: [],
    children: toRuns(paragraph).map((run, runIndex) => ({
      _type: 'span',
      _key: `${slug}-${index}-${runIndex}`,
      text: run.text,
      marks: run.strong ? ['strong'] : [],
    })),
  }));
}

function section(slug: string, heading: string, paragraphs: Paragraph[]) {
  return { _type: 'exhibitorSection', heading, body: portableText(slug, paragraphs) };
}

// ---------------------------------------------------------------------------
// The three marker labels. Editable in one place, reused everywhere, hardcoded in no
// component — ExhibitorStatusBadge receives all three as props.
// ---------------------------------------------------------------------------

const PENDING_LABEL = 'To be confirmed by the show committee';
const RESEARCH_LABEL =
  'Researched international show practice — a starting point for the show committee, ' +
  'not yet SAOC policy';
const QUESTION_LABEL = 'Open question for the show committee — we could not establish this';

// ---------------------------------------------------------------------------
// Key dates — research sections 1 and 2. Every row pending; every `dateNote` free text.
//
// The notes are deliberately worded differently row by row rather than repeating one
// phrase. A single shared placeholder string would make it impossible to tell, from the
// rendered page, whether a change to one row had actually taken effect.
// ---------------------------------------------------------------------------

const KEY_DATES = [
  {
    label: 'Entries close',
    dateNote: 'To be set by the show committee',
    detail: 'The last date to register your plants.',
  },
  {
    label: 'Staging opens',
    dateNote: 'Staging start not set — the show committee will confirm it',
    detail: 'When you can start delivering and benching plants.',
  },
  {
    label: 'Staging closes',
    dateNote: 'Staging cut-off not set — the show committee will confirm it',
    detail: 'Most shows expect every plant to be on its bench before staging closes.',
  },
  {
    label: 'Judging',
    dateNote: 'Judging schedule not set — the show committee will confirm it',
    detail: 'Shows generally judge once staging has closed, before the public are admitted.',
  },
  {
    label: 'Show open to the public',
    dateNote: 'See the show overview page',
    detail: 'The show dates themselves are held on the show record, not here.',
  },
  {
    label: 'Removal',
    dateNote: 'Removal time not set — the show committee will confirm it',
    detail:
      'Whether anything may be collected early has not been set — most shows keep exhibits ' +
      'benched for the full run.',
  },
].map((row, index) => ({
  _type: 'showExhibitorDate',
  _key: `keyDate-${index}`,
  status: 'pending',
  ...row,
}));

// ---------------------------------------------------------------------------
// Open questions — research section 12, one entry each, plus the South African
// divergences from section 11. Published rather than filled in with a plausible guess.
// ---------------------------------------------------------------------------

const OPEN_QUESTIONS = [
  {
    topic: 'deadlines',
    question: 'How far before the show do entries close?',
    context:
      'Lead times across the shows we surveyed range from same-week on-site registration to ' +
      'multi-week advance cut-offs. There is no interval consistent enough to inherit.',
  },
  {
    topic: 'fees',
    question: 'Is there an entry fee, and is it charged per plant, per exhibitor, or both?',
    context:
      'Per-plant, per-exhibitor and separate-award-fee models all exist. The three-part model ' +
      'is specific to shows affiliated to the American Orchid Society and is one option rather ' +
      'than the norm.',
  },
  {
    topic: 'eligibility',
    question: 'Must an exhibitor have grown a plant for a minimum period before entering it?',
    context:
      'The principle is widespread. The Orchid Society of Great Britain uses twelve months for ' +
      'its main classes, but the period is show-specific and SAOC has not set one.',
  },
  {
    topic: 'display-build',
    question:
      'Who may build a society display stand, and are there height, size or material limits?',
    context: 'No published show rules we found covered this at all.',
  },
  {
    topic: 'sales',
    question: 'May exhibitors sell plants directly from their competitive entries?',
    context:
      'Every show we surveyed separated vendor sales from the judged floor, but none addressed ' +
      'selling from the bench either way.',
  },
  {
    topic: 'security',
    question: 'What overnight security covers benched plants?',
    context:
      'Not published by any show we surveyed. Arrangements of this kind tend to live in internal ' +
      'committee paperwork rather than on a website.',
  },
  {
    topic: 'watering',
    question:
      'Who waters and cares for plants during the run of the show — the exhibitor or the committee?',
    context: 'Not published by any show we surveyed.',
  },
  {
    topic: 'loading',
    question: 'Where do exhibitors load and unload, and when is the loading bay accessible?',
    context:
      'Venue logistics are published for visitors rather than for exhibitors at every show we ' +
      'looked at.',
  },
  {
    topic: 'insurance',
    question: 'Are exhibited plants insured, and who carries the liability for loss or damage?',
    context: 'Not published by any show we surveyed.',
  },
  {
    topic: 'results-notification',
    question: 'How are exhibitors told their results before the public opening?',
    context:
      'No consistent practice emerged. Some shows post a results sheet; others tell exhibitors ' +
      'individually; most say nothing about it publicly.',
  },
  {
    topic: 'permits',
    question:
      'Does any domestic plant-movement or biosecurity requirement apply to moving orchids ' +
      'between South African provinces?',
    context:
      'Distinct from CITES, which governs international movement only. Our search surfaced no ' +
      'such requirement, which is not the same as confirming none exists.',
  },
  {
    topic: 'permits',
    question:
      'Does exhibiting propagated indigenous species such as Disa or Eulophia carry any ' +
      'provenance or permit requirement?',
    context:
      'Not resolved by the sources we found. This needs direct confirmation from the council ' +
      'rather than an assumption either way.',
  },
  {
    topic: 'precedent',
    question:
      'Can the council supply exhibitor packs, entry forms or rules from past National Shows?',
    context:
      'No archived SAOC exhibitor pack, entry form or rules document was locatable online. Past ' +
      'packs are the authoritative local precedent and would replace most of the researched ' +
      'defaults on this page.',
  },
].map((row, index) => ({
  _type: 'exhibitorQuestion',
  _key: `question-${index}`,
  order: (index + 1) * 10,
  ...row,
}));

// ---------------------------------------------------------------------------
// The singleton payload.
// ---------------------------------------------------------------------------

const EXHIBITOR_INFO_FIELDS: Record<string, unknown> = {
  title: 'Exhibitor Information',
  intro:
    'Everything we currently know about entering plants in the 19th South African National ' +
    'Orchid Show — and, just as importantly, everything that is not settled yet. Most of what ' +
    'follows is established practice at orchid shows internationally, offered so the show ' +
    'committee has something to correct rather than a blank page. None of it is SAOC policy ' +
    'until the committee says so.',

  pendingLabel: PENDING_LABEL,
  researchLabel: RESEARCH_LABEL,
  questionLabel: QUESTION_LABEL,

  keyDatesHeading: 'Key dates',
  keyDatesNote:
    'None of these dates are set yet. The show committee will confirm them and they will be ' +
    'published here. Do not make travel or freight arrangements against anything on this page.',
  // The table's accessible name and nothing else. Whether the dates are set is the markers'
  // job, per row — a caption that says it too contradicts the table the day one is confirmed.
  keyDatesCaption: 'Key dates for exhibitors',
  keyDates: KEY_DATES,

  entryFormHeading: 'Entry form',
  entryFormPendingNote:
    'The entry form for the 19th National Show has not been published yet. When the show ' +
    'committee releases it, it will be available for download here. In the meantime, contact ' +
    'the council if you intend to exhibit.',

  // --- research section 1 ---
  entryProcess: section('entryProcess', 'How entry works', [
    'Orchid shows around the world run entry the same broad way: you register your plants ahead ' +
      'of the show under an exhibitor number, and each plant is entered against a numbered class ' +
      'from a published show schedule. Registration usually opens well before the show and closes ' +
      'before staging begins; some shows also accept on-the-day entries, and some do not.',
    [
      { text: 'One point is near-universal and worth knowing in advance: ' },
      {
        text: "matching your plant to the right class is the exhibitor's job, not the show committee's.",
        strong: true,
      },
      {
        text:
          ' Judges may reclassify or disqualify a plant entered in the wrong class. Established ' +
          'shows publish a genus-to-class cross-reference to help with this.',
      },
    ],
    "SAOC's own entry process for the 19th National Show has not been published yet.",
  ]),

  // --- research section 1, fee structuring ---
  fees: section('fees', 'Entry fees', [
    'Entry fees for the 19th National Show have not been set. Shows structure them differently ' +
      '— some charge per plant entered, some a flat fee per exhibitor, and shows affiliated to ' +
      'an accredited judging body sometimes add a separate fee for formal award judging on top ' +
      'of the show entry itself. Which of these SAOC will use is for the show committee to decide.',
  ]),

  // --- research section 3. Links to the class list; restates not one class code ---
  classes: section('classes', 'Classes', [
    'Show classes are the categories your plants compete in. They are normally organised by ' +
      'genus or alliance — Cattleya and its relatives, Oncidiinae, Paphiopedilum, Phalaenopsis, ' +
      'Vandeae and so on — with separate classes for single plants and for groups, plus catch-all ' +
      'classes for genera that do not fit elsewhere. Many shows also run a novice or ' +
      'first-time-exhibitor class, and judges may split a class that attracts a large number of ' +
      'entries.',
    [{ text: 'The classes for this show are listed on the show overview page.', strong: true }],
  ]),

  // --- research section 4. Links to /judging; restates no criterion or points scale ---
  judging: section('judging', 'Judging', [
    'At most shows, judging takes place after staging closes and before the public are let in, ' +
      'with exhibitors not present while the judges deliberate. Larger shows commonly run two ' +
      'tracks at once: the show\'s own placings — first, second, third — and separate formal ' +
      'awards assessed against a points standard by accredited judges.',
    [
      {
        text:
          'Two conventions worth knowing: an exhibitor who does not want a plant formally judged ' +
          'can normally say so, and individual plants inside a society display are usually ',
      },
      { text: 'not', strong: true },
      {
        text:
          ' entered into individual judging unless the exhibitor marks and registers them ' +
          'separately.',
      },
    ],
    [
      {
        text: "SAOC's judging standards are published in full on the judging pages.",
        strong: true,
      },
      {
        text:
          ' Whether exhibitors may be present during judging at the National Show has not been ' +
          'confirmed.',
      },
    ],
  ]),

  // --- research section 5 ---
  eligibility: section('eligibility', 'Plant condition and eligibility', [
    'Two requirements are effectively universal across judged orchid shows.',
    [
      { text: 'Free of pests and disease.', strong: true },
      {
        text:
          ' Entries are inspected, and a plant that fails inspection is removed from the bench. ' +
          'This protects every other plant in the hall, so it is enforced strictly everywhere.',
      },
    ],
    [
      { text: 'Correctly labelled.', strong: true },
      {
        text:
          ' Your label needs the full name — genus and species, or the full hybrid name with its ' +
          'parentage. Where a hybrid has never been formally registered, the accepted practice is ' +
          'to give the trade name, or the genus name followed by the word "hybrid", rather than ' +
          'leaving it blank. A plant that cannot be identified generally cannot be judged.',
      },
    ],
    [
      { text: 'Many shows also require that you have ' },
      { text: 'grown the plant yourself for a minimum period', strong: true },
      {
        text:
          ' before it is eligible — the Orchid Society of Great Britain, for example, requires ' +
          "twelve months' possession for its main classes. The principle is widespread; the " +
          "period varies from show to show, and SAOC's has not been set.",
      },
    ],
  ]),

  // --- research section 6 ---
  display: section('display', 'Displays and stands', [
    'Society and group displays are usually judged as their own category, separate from ' +
      'individual plant classes, with each group given a defined amount of floor space. Where ' +
      'shows allow non-orchid plants in a display for staging effect, they normally cap them — ' +
      'the Orchid Society of Great Britain limits ornamental material to half the exhibit.',
    'Practical questions we could not answer from published show rules anywhere: who is allowed ' +
      'to build a display stand, whether height or structural limits apply, and what materials ' +
      'are permitted. These are listed in the questions below.',
  ]),

  // --- research section 7 ---
  sales: section('sales', 'Selling plants', [
    'Every show we looked at keeps retail plant sales structurally separate from the competitive ' +
      'floor: vendors work from their own trade area with their own setup process, and that is a ' +
      'different arrangement from entering plants for judging.',
    'Whether an exhibitor may sell plants directly from a competitive entry is a different ' +
      'question, and no published show rules we found address it either way. It is one for the ' +
      'committee.',
  ]),

  // --- research section 8 ---
  practicalities: section('practicalities', 'Insurance, security, watering and loading', [
    [
      {
        text:
          'This is the part of exhibiting that published show rules are quietest about. Overnight ' +
          'security for benched plants, who waters them during the run, insurance and liability, ' +
          'and where exhibitors load and unload were ',
      },
      { text: 'not covered in any public exhibitor document we could find', strong: true },
      {
        text:
          ' — not because shows have no arrangements, but because those arrangements tend to live ' +
          'in internal committee paperwork rather than on a website.',
      },
    ],
    "We are not going to guess at SAOC's. Each of these is listed as an open question below, and " +
      'the answers will be published here once the show committee has settled them.',
  ]),

  // --- research section 11. The block most likely to do harm if got wrong ---
  permits: section('permits', 'Permits and moving plants between provinces', [
    [
      {
        text: 'CITES does not apply to moving your cultivated plants around South Africa.',
        strong: true,
      },
      {
        text:
          ' CITES governs international trade — import, export and re-export across a national ' +
          'border. Bringing plants from one province to another for a national show is not ' +
          'international trade, and no CITES paperwork follows from it. CITES would only come ' +
          'into play if a plant were being brought into South Africa from abroad for the show.',
      },
    ],
    [
      { text: 'What we cannot tell you is whether any ' },
      { text: 'domestic', strong: true },
      {
        text:
          ' rule applies — a provincial plant-movement or agricultural-biosecurity requirement ' +
          'unrelated to CITES, or any documentation specific to propagated indigenous species ' +
          'such as Disa or Eulophia. We searched and found nothing, but finding nothing is not ' +
          'the same as confirming there is nothing. Both are open questions for the committee ' +
          'below.',
      },
    ],
    'Growing and showing orchids in cultivation is SAOC\'s remit. For southern Africa\'s wild ' +
      'orchids, see Wild Orchids of Southern Africa at wildorchids.co.za.',
  ]),

  questionsHeading: 'Questions for the show committee',
  questionsIntro:
    'These are the things we could not establish from published orchid-show practice anywhere in ' +
    'the world, or that are specific to South Africa. They are listed openly rather than filled ' +
    'in with a plausible guess, because an exhibitor who plans around a guess and finds it wrong ' +
    'at the door has been let down by us. Each will be answered here once the show committee has ' +
    'decided.',
  openQuestions: OPEN_QUESTIONS,

  confirmations: {
    _type: 'exhibitorConfirmationStatuses',
    entryProcess: 'research',
    fees: 'pending',
    classes: 'research',
    judging: 'research',
    eligibility: 'research',
    display: 'research',
    sales: 'research',
    practicalities: 'question',
    permits: 'question',
    entryForm: 'pending',
  },

  judgingLinkLabel: 'SAOC judging standards',
  classesLinkLabel: 'Show classes',
  contactNote:
    'If you are planning to exhibit and need an answer before these pages are complete, contact ' +
    'the council directly and we will put you in touch with the show committee.',
};

// ---------------------------------------------------------------------------
// The seven journey steps — research sections 1, 2, 4, 5 and 8.
// Orders in tens so the committee can insert a step without renumbering everything.
// ---------------------------------------------------------------------------

interface StepSeed {
  id: string;
  order: number;
  title: string;
  when: string;
  status: string;
  body: Paragraph[];
}

const STEPS: StepSeed[] = [
  {
    id: 'showExhibitorStep-decide',
    order: 10,
    title: 'Decide to enter',
    when: 'As early as you can',
    status: 'research',
    body: [
      'Shows publish a schedule listing every judging class, and exhibitors register plants ' +
        'against it under an exhibitor number. Reading the schedule early is what tells you which ' +
        'of your plants have a class to go in.',
    ],
  },
  {
    id: 'showExhibitorStep-enter',
    order: 20,
    title: 'Enter by the deadline',
    when: 'By the published entry deadline',
    status: 'pending',
    body: [
      'Almost every show has a cut-off after which entries are no longer accepted, but how far ' +
        'ahead of the show it falls varies enormously. SAOC has not set one for the 19th National ' +
        'Show. It will be published here and on the key-dates table above.',
    ],
  },
  {
    id: 'showExhibitorStep-prepare',
    order: 30,
    title: 'Prepare and label your plants',
    when: 'In the weeks before the show',
    status: 'research',
    body: [
      'Two things are close to universal: entries are inspected for pests and disease, and every ' +
        'plant needs a label carrying its full name. Getting both right before you travel is ' +
        'easier than fixing either at the bench.',
    ],
  },
  {
    id: 'showExhibitorStep-deliver',
    order: 40,
    title: 'Deliver and stage',
    when: 'During the staging window, before the show opens',
    status: 'pending',
    body: [
      'Plants are delivered and benched during a fixed window before the show opens, with the ' +
        'hall closed to the public while that happens. How long SAOC will allow, and on which ' +
        'days, is for the show committee to set.',
    ],
  },
  {
    id: 'showExhibitorStep-judging',
    order: 50,
    title: 'Judging day',
    when: 'After staging closes, before the public are admitted',
    status: 'research',
    body: [
      'Judging generally happens in a closed hall between the end of staging and the public ' +
        'opening, with exhibitors not present. An exhibitor who would rather a plant were not ' +
        'formally judged can normally say so.',
    ],
  },
  {
    id: 'showExhibitorStep-show-days',
    order: 60,
    title: 'During the show',
    when: 'The full run of the show',
    status: 'question',
    body: [
      'At most shows plants stay on the bench for the whole run. Who waters and cares for them ' +
        'while they are there, and what security covers them overnight, is the part of ' +
        'exhibiting no show we surveyed publishes. It is an open question for the committee.',
    ],
  },
  {
    id: 'showExhibitorStep-removal',
    order: 70,
    title: 'Removal and collection',
    when: 'After the published closing time',
    status: 'pending',
    body: [
      'Shows expect plants to remain benched until the published closing time and to be collected ' +
        'after it. When that is, and how long exhibitors have to clear the hall, has not been set.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Writing. createIfNotExists + setIfMissing, and the write is SKIPPED entirely when
// nothing is absent — a committed no-op still bumps _rev, which would make the seed
// non-idempotent in the only way that matters to the check.
// ---------------------------------------------------------------------------

function missingFields(
  existing: Record<string, unknown>,
  candidates: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(candidates).filter(([field]) => {
      const value = existing[field];
      return value === undefined || value === null;
    }),
  );
}

async function seedDocument(
  id: string,
  type: string,
  fields: Record<string, unknown>,
): Promise<void> {
  // Read before writing. createIfNotExists is a no-op against an existing document, but
  // it is still a committed transaction, and Sanity assigns a fresh _rev to any document
  // a transaction touches. Issuing it unconditionally would move the revision on every
  // run — idempotent in content, not in the dataset.
  let existing = (await client.getDocument(id)) as Record<string, unknown> | undefined;
  if (!existing) {
    await client.createIfNotExists({ _id: id, _type: type });
    existing = {};
  }

  const missing = missingFields(existing, fields);

  if (Object.keys(missing).length === 0) {
    console.log(`  ${id}: already populated — no write issued`);
    return;
  }

  await client.patch(id).setIfMissing(missing).commit({ autoGenerateArrayKeys: false });
  console.log(`  ${id}: setIfMissing ${Object.keys(missing).join(', ')}`);
}

async function main(): Promise<void> {
  console.log(`Seeding exhibitor content into ${projectId}/${dataset}`);
  console.log('showExhibitorInfo:');
  await seedDocument(EXHIBITOR_INFO_ID, 'showExhibitorInfo', EXHIBITOR_INFO_FIELDS);

  console.log('showExhibitorStep documents:');
  for (const step of STEPS) {
    await seedDocument(step.id, 'showExhibitorStep', {
      title: step.title,
      when: step.when,
      body: portableText(step.id, step.body),
      order: step.order,
      status: step.status,
      active: true,
    });
  }

  console.log('Done. Nothing was seeded as committee-confirmed fact.');
}

main().catch((error: unknown) => {
  console.error('[seed-show-exhibitor-info] failed', error);
  process.exitCode = 1;
});

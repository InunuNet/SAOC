// Parses Lee-Ann's frozen landing-page doc into the exact strings the home restore must render.
// Her editorial notes (after " – " on a note line, "Copy needs to be provided", "The blow needs...") are never extracted.
import { readFileSync } from 'node:fs';

export const SPEC = '.agent/memory/project/specs/nos-home-restore';
export const SOURCE = `${SPEC}/goldens/sources/landing-page-v1.0.md`;

// Same de-markdown rule as nos-content-standard/checks/gate-standard.mjs spUnmd.
export const unmd = (b) => b.replace(/\\([.\-_*#>()[\]!])/g, '$1').replace(/\*\*|__/g, '').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
export const norm = (t) => t.replace(/\s+/g, ' ').trim();
const strip = (l) => unmd(l.replace(/^\s*(\*|\+|-)\s+(\+\s+)?/, ''));

export function parseLanding(path = SOURCE) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const find = (re) => { const i = lines.findIndex((l) => re.test(l)); if (i < 0) throw new Error(`landing doc: no line matches ${re}`); return i; };
  const tagline = /“(Three years in the making, four days on the bench)”/.exec(lines[find(/Three years in the making/)])[1];
  const para1 = strip(lines[find(/^\s+\+ The National Orchid Show is the country/)]);
  const para2 = strip(lines[find(/^\* \+ Every plant submitted/)]);
  const iFig = find(/^\* 3 Years/);
  const figures = [0, 1, 2].map((k) => strip(lines[iFig + k]));
  const groups = [];
  for (let i = find(/^\* Group 1:/); i < lines.length; i += 1) {
    const m = /^\* Group (\d+): (.+)$/.exec(lines[i]);
    if (!m) { if (/^\* \*\*Section 4/.test(lines[i])) break; continue; }
    const d = /^\s+\+ (.+)$/.exec(lines[i + 1] ?? '');
    const italics = d ? [...d[1].matchAll(/(^|[^*])\*([^*\n]+)\*/g)].map((x) => x[2].replace(/\s+/g, ' ').trim()) : [];
    groups.push({ n: Number(m[1]), label: `Group ${m[1]}`, name: unmd(m[2]), description: d ? unmd(d[1]) : null, italics });
  }
  const stages = [];
  for (const k of ['01', '02', '03', '04']) {
    const i = find(new RegExp(`^\\*\\*Stage ${k}\\*\\*`));
    const body = []; for (let j = i + 1; body.length < 2; j += 1) if (lines[j].trim()) body.push(unmd(lines[j]));
    stages.push({ stage: k, title: body[0], description: body[1] });
  }
  const startPlanning = unmd(lines[find(/^\*\*Start planning your entry now\.\*\*/)]);
  const registerHere = unmd(lines[find(/^Register Here – /)]).split(' – ')[0];
  const cta = unmd(lines[find(/^The 19th National Orchid Show opens on/)]);
  return { tagline, para1, para2, figures, groupsHeading: 'Ten judging groups', groups, plantEntryHeading: unmd(lines[find(/^\*\*Plant Entry for SAOC Members\*\*/)]), stages, startPlanning, registerHere, cta };
}

/** Her editorial notes to us: none may ever render. Each is a substring of the source. */
export const EDITORIAL_NOTES = [
  'The blow needs to be added to this page',
  'Why was this removed?',
  'Copy needs to be provided',
  'Copy and photos need to be provided',
  'Takes you to a show entry registration form that needs to be provided',
  'Sent request to Nitsi and Fiona',
  'Added to google drive',
  'Provided in the Google folder',
  'This link is working',
  'Link is good',
  'Can we put it back in',
];

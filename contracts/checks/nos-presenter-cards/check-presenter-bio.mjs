// nos-presenter-cards F1 — verbatim bio parsing (golden §5). Functional: imports
// lib/view-models/presenter-bio.ts. Bios are rendered EXACTLY as stored in Sanity: one block
// per non-empty line, lines starting with "• " become list items (consecutive items share one
// list, marker removed), every other line is a paragraph with its text untouched (double
// spaces, stray commas and a "•" with no following space all survive).
//
// Run as: node contracts/checks/nos-presenter-cards/check-presenter-bio.mjs
import { finish, loadRepoModule } from './_lib.mjs';

const REL = 'lib/view-models/presenter-bio.ts';
const failures = [];

let mod;
try {
  mod = await loadRepoModule(REL);
} catch (error) {
  finish('check-presenter-bio.mjs', [`cannot import ${REL}: ${error.message}`]);
}
const { parseBio } = mod;

const cases = [
  { label: 'null', input: null, want: [] },
  { label: 'empty', input: '', want: [] },
  {
    label: 'paragraphs and grouped bullets, text verbatim',
    input:
      'In 1990 she won.  This was the start,\n\nIntro including:\n\n• The European Orchid Congress 2006 in Italy\n\n• National Orchid Show in South Africa 2006\n\nShe is co-author of the “Grow Disas” book with Graham Duncan,\n\n• Lone item',
    want: [
      { kind: 'p', text: 'In 1990 she won.  This was the start,' },
      { kind: 'p', text: 'Intro including:' },
      { kind: 'ul', items: ['The European Orchid Congress 2006 in Italy', 'National Orchid Show in South Africa 2006'] },
      { kind: 'p', text: 'She is co-author of the “Grow Disas” book with Graham Duncan,' },
      { kind: 'ul', items: ['Lone item'] },
    ],
  },
  {
    label: 'single newlines and CRLF still separate blocks',
    input: 'Line one\nLine two\r\n\r\n• A\n• B',
    want: [
      { kind: 'p', text: 'Line one' },
      { kind: 'p', text: 'Line two' },
      { kind: 'ul', items: ['A', 'B'] },
    ],
  },
  {
    label: 'only "• " (bullet + space) marks an item',
    input: '•Tight\n\n- dash line\n\n* star line',
    want: [
      { kind: 'p', text: '•Tight' },
      { kind: 'p', text: '- dash line' },
      { kind: 'p', text: '* star line' },
    ],
  },
  {
    label: 'one paragraph, no newline (Wijaya shape)',
    input: 'Elbert grew up in Jakarta.  His primary passions (you know the species name!), and more.',
    want: [{ kind: 'p', text: 'Elbert grew up in Jakarta.  His primary passions (you know the species name!), and more.' }],
  },
];

if (typeof parseBio !== 'function') {
  failures.push(`${REL} must export function parseBio(text: string | null): BioBlock[]`);
} else {
  for (const c of cases) {
    let got;
    try {
      got = parseBio(c.input);
    } catch (error) {
      failures.push(`parseBio threw on "${c.label}": ${error.message}`);
      continue;
    }
    if (JSON.stringify(got) !== JSON.stringify(c.want)) {
      failures.push(`"${c.label}":\n      want ${JSON.stringify(c.want)}\n      got  ${JSON.stringify(got)}`);
    }
  }
}

finish('check-presenter-bio.mjs', failures, 'parseBio renders stored bio text verbatim, "• " lines as grouped list items.');

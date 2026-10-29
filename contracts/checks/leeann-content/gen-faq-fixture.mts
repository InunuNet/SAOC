// Derives the FAQ golden (goldens/faq/faq-docs.json) from her faq.txt, deterministically.
// Usage: pnpm exec tsx contracts/checks/leeann-content/gen-faq-fixture.mts [--write]
//   no flag  prints the JSON; --write replaces goldens/faq/faq-docs.json (architect only, never @dev).
// fd.mts faq-fixture proves the committed golden still equals this derivation.
import { readFileSync, writeFileSync } from 'node:fs';
import { GOLDENS, mdToBlocks, readSource } from './lib.mts';

export interface FaqSection {
  id: string;
  number: number;
  title: string;
  intro: string[];
}
export interface FaqQuestion {
  _id: string;
  number: number;
  section: string;
  question: string;
  answer: string[];
}
export interface FaqFixture {
  sections: FaqSection[];
  questions: FaqQuestion[];
  legacyIds: string[];
}

const LEGACY_IDS_PATH = `${GOLDENS}/faq/legacy-ids.json`;

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function deriveFaqFixture(): FaqFixture {
  const sections: FaqSection[] = [];
  const questions: FaqQuestion[] = [];
  let current: FaqQuestion | null = null; // the question whose answer is being read; null in a section intro
  const rawLines = readSource('faq').split('\n').slice(1); // line 1 is the document title
  for (const raw of rawLines) {
    const text = raw.trim() === '' ? undefined : mdToBlocks(raw)[0];
    if (!text) continue;
    const heading = /^\*\*(\d+)\.\s+.+\*\*$/.test(raw.trim()) ? /^(\d+)\.\s+(.+)$/.exec(text) : null;
    if (heading) {
      const number = Number(heading[1]);
      const title = heading[2];
      if (title.endsWith('?')) {
        current = { _id: `showFaq-q${number}`, number, section: sections[sections.length - 1].id, question: title, answer: [] };
        questions.push(current);
      } else {
        current = null;
        sections.push({ id: slug(title), number, title, intro: [] });
      }
    } else if (current) {
      current.answer.push(text);
    } else {
      sections[sections.length - 1].intro.push(text);
    }
  }
  const legacy = JSON.parse(readFileSync(LEGACY_IDS_PATH, 'utf8')) as string[];
  return { sections, questions, legacyIds: legacy };
}

if (process.argv[1]?.endsWith('gen-faq-fixture.mts')) {
  const json = `${JSON.stringify(deriveFaqFixture(), null, 2)}\n`;
  if (process.argv.includes('--write')) writeFileSync(`${GOLDENS}/faq/faq-docs.json`, json);
  else process.stdout.write(json);
}

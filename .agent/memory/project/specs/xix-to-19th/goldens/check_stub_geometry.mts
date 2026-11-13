// Asserts the ticket stub numeral "19th" does not reach the date/time column. Run with cwd = repo root (pnpm --dir).
// Parses the layout constants from lib/ticket-pdf.ts so it follows the dev's values, measures "19th" in the real font.
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const src = readFileSync('lib/ticket-pdf.ts', 'utf8');
const num = (name: string): number => {
  const m = src.match(new RegExp(`const ${name} = ([0-9.]+)`));
  if (!m) throw new Error(`constant ${name} not found`);
  return Number(m[1]);
};
const perforation = num('PERFORATION_X');
const markRight = perforation - 6; // STUB_MARK_RIGHT_X = PERFORATION_X - 6 (asserted below)
if (!/const STUB_MARK_RIGHT_X = PERFORATION_X - 6;/.test(src)) throw new Error('STUB_MARK_RIGHT_X changed; update this check');
const numeral = src.match(/const STUB_NUMERAL = '([^']+)'/)?.[1];
if (numeral !== '19th') throw new Error(`STUB_NUMERAL is ${numeral}, want 19th`);
const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const font = await doc.embedFont(readFileSync('lib/ticket-pdf-assets/Fraunces-Light.ttf'));
const widthMm = (font.widthOfTextAtSize(numeral, num('STUB_NUMERAL_SIZE')) / 72) * 25.4;
const markLeft = markRight - widthMm;
const dateRight = num('STUB_TEXT_X') + num('STUB_DATE_ROOM');
const gap = markLeft - dateRight;
console.log(`19th width ${widthMm.toFixed(1)}mm, mark left ${markLeft.toFixed(1)}mm, date column right ${dateRight.toFixed(1)}mm, gap ${gap.toFixed(1)}mm`);
if (gap < 3) { console.error('FAIL: date/time column overlaps or crowds the 19th mark (need >= 3mm)'); process.exit(1); }

// A3: the archive year page must not import components/ui/ArrowIcon (NOS keeps one arrow system, the keepsake).
import { readFileSync } from 'node:fs';

const FILE = 'app/(nos)/national-show/archive/[year]/page.tsx';
const src = readFileSync(FILE, 'utf8');
const bad = src.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /^\s*import\b.*components\/ui\/ArrowIcon/.test(l));
if (bad.length) { console.error(`${FILE} imports components/ui/ArrowIcon:\n- ${bad.map((b) => `:${b.n} ${b.l.trim()}`).join('\n- ')}`); process.exit(1); }
console.log(`${FILE} does not import components/ui/ArrowIcon`);

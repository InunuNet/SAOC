// nos-critique-r9 f1 static (lockup image delivery, Codi FINAL): artwork and source files unchanged, only delivery changes.
//   S1  NosHeader.tsx draws the lockup as ONE <picture> (a media <source> for the narrow box plus the <img>), 1x/2x density srcsets capped at 2x of the box (no sizes), img eager and high priority, width 1200 x height 294, the same alt, source path unchanged
//   S2  NosFooter.tsx has ONE <picture>: a <source media="(max-width: 700px)"> (inclusive 700) carrying the vertical with its own width/height 900x791, and ONE <img> for the horizontal,
//       loading="lazy" decoding="async", no fetchPriority, no loading="eager"; the two plain eager <img> are gone
//   S3  the supplied artwork is untouched: both source paths are still the /images/nos PNGs and nothing under branding/ or public/images/nos changed (footprint f1)
//   S4  alt text and the link/aria structure are unchanged: the LOCKUP_ALT constant and the header aria-label are byte-identical to BASE
//   S5  docs/nos-critique-r9.md exists
import { DOC, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const headerRel = 'components/nos-chrome/NosHeader.tsx';
const footerRel = 'components/nos-chrome/NosFooter.tsx';
const header = readRepoFile(headerRel);
const footer = readRepoFile(footerRel);
if (header === null || footer === null) fail('NosHeader.tsx or NosFooter.tsx is missing');
else {
  const h = stripComments(header);
  const hf = h.replace(/\s+/g, ' ');
  const pics = (hf.match(/<picture\b/g) ?? []).length;
  const srcs = hf.match(/<source\b[^>]*>/g) ?? [];
  const img = hf.match(/<img\b[^>]*>/);
  if (pics !== 1 || srcs.length !== 1 || !/media=/.test(srcs[0])) fail('NosHeader.tsx needs ONE <picture> with ONE media <source>: the narrow (<=699px) 390px box has its own 1x/2x pair (S1)');
  if (!img) fail('NosHeader.tsx must draw the lockup with an <img> inside the picture (S1)');
  else {
    if (!/fetchPriority="high"|priority/.test(img[0])) fail('the header <img> must stay high priority (fetchPriority="high") (S1)');
    if (/loading="lazy"/.test(img[0])) fail('the header <img> must stay eager (S1)');
    if (!/width=\{LOCKUP_WIDTH\}/.test(img[0]) || !/height=\{LOCKUP_HEIGHT\}/.test(img[0])) fail('the header <img> keeps width={LOCKUP_WIDTH} height={LOCKUP_HEIGHT} (S1)');
    if (!/alt=\{LOCKUP_ALT\}/.test(img[0])) fail('the header <img> keeps alt={LOCKUP_ALT} (S1)');
  }
  if (/\bsizes=/.test(hf)) fail('the header uses 1x/2x density srcsets capped at 2x of the box; no w-descriptor sizes (S1)');
  if (!/const LOCKUP_SRC = '\/images\/nos\/nos-full-colour-horizontal-1200\.png'/.test(h)) fail('the header source path must stay the supplied PNG (S3)');

  const f = stripComments(footer).replace(/\s+/g, ' ');
  if ((f.match(/<picture\b/g) ?? []).length !== 1) fail('NosFooter.tsx needs exactly ONE <picture> (S2)');
  const sources = f.match(/<source\b[^>]*>/g) ?? [];
  if (sources.length !== 1 || !/media="\(max-width: 700px\)"/.test(sources[0])) fail('the picture needs exactly one <source media="(max-width: 700px)"> (inclusive 700, art direction for the vertical) (S2)');
  else if (!/width=\{?"?\{?VERTICAL_WIDTH|width=\{VERTICAL_WIDTH\}|width="900"/.test(sources[0]) || !/height=\{VERTICAL_HEIGHT\}|height="791"/.test(sources[0])) fail('the <source> carries width/height 900x791 so the narrow layout reserves the vertical aspect (S2)');
  const imgs = f.match(/<img\b[^>]*>/g) ?? [];
  if (imgs.length !== 1) fail(`NosFooter.tsx needs exactly one <img> inside the picture, found ${imgs.length} (S2)`);
  else {
    if (!/loading="lazy"/.test(imgs[0]) && !/loading: 'lazy'/.test(f)) fail('the footer <img> must be loading="lazy" (S2)');
    if (!/decoding="async"/.test(imgs[0]) && !/decoding: 'async'/.test(f)) fail('the footer <img> must be decoding="async" (S2)');
  }
  if (/fetchPriority|fetchpriority/i.test(f)) fail('the footer must not set fetchPriority (S2)');
  if (/loading="eager"|loading: 'eager'/.test(f)) fail('the footer must not be eager (S2)');
  if (!/HORIZONTAL_SRC = '\/images\/nos\/nos-reversed-horizontal-1200\.png'/.test(f) || !/VERTICAL_SRC = '\/images\/nos\/nos-reversed-white-vertical-900\.png'/.test(f)) fail('the footer source paths must stay the supplied PNGs (S3)');

  for (const [rel, src] of [[headerRel, header], [footerRel, footer]]) {
    const base = readBaseFile(rel);
    if (base === null) continue;
    const alt = (t) => (t.match(/const LOCKUP_ALT = '[^']*'/) ?? [''])[0];
    if (alt(src) !== alt(base)) fail(`${rel.split('/').pop()}: LOCKUP_ALT changed (S4)`);
  }
  const bh = readBaseFile(headerRel);
  const label = (t) => (t.match(/aria-label=\{`[^`]*`\}/) ?? [''])[0];
  if (bh !== null && label(header) !== label(bh)) fail('the header brand link aria-label changed (S4)');
}
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S5)`);

finish('f1-static.mjs', failures, 'header uses next/image (priority, sizes, same dimensions and alt); footer is ONE picture with a (max-width: 700px) vertical source and a lazy async horizontal img, no fetchPriority; artwork paths and alt unchanged.');

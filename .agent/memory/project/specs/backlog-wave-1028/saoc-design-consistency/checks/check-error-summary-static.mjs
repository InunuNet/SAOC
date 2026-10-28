// F1a: every error summary (role="alert" element bordered with --status-error) uses a 2px border, the token as text colour, NO background tint
// (the golden: border and icon carry the state, never a fill), and carries an aria-hidden icon next to the text (never colour alone).
// Instances are ENUMERATED by scanning every .tsx under app/ and components/, not from a file list, so a new form is covered automatically.
// Static: the vendor forms render only on the NOS host, which redirects away from the SAOC host in a browser.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { check, finish } from './lib.mjs';
const ROOTS = ['app', 'components'];
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : walk(p)) : /\.tsx$/.test(n) ? [p] : []; });
// The element's opening tag: from the "<" before role="alert" to the first ">" that closes it (a ">" that ends a line or follows a quote/brace).
const openingTag = (src, at) => { const start = src.lastIndexOf('<', at); const m = /["}'`]\s*>|>\s*\n/.exec(src.slice(at)); return src.slice(start, m ? at + m.index + m[0].length : at + 400); };
const BG = /(^|[\s"'`:])(?!bg-transparent\b)bg-(?!clip|origin|none\b|no-repeat|repeat|center|cover|contain|fixed|local|scroll)[\w\[\]\/().#%-]+/;
let found = 0; const files = ROOTS.flatMap(walk);
for (const file of files) {
  const src = readFileSync(file, 'utf8'); if (!src.includes('role="alert"')) continue;
  for (const m of src.matchAll(/role="alert"/g)) {
    const tag = openingTag(src, m.index); if (!tag.includes('border-[var(--status-error)]')) continue;
    found++; const box = src.slice(m.index, m.index + 700); const label = `${file}:${src.slice(0, m.index).split('\n').length}`;
    check(/\bborder-2\b/.test(tag), `${label}: border is not 2px (needs border-2)`);
    check(!BG.test(tag), `${label}: error summary carries a background tint (${(tag.match(BG) || [''])[0].trim()}), want none (border and icon only)`);
    check(/<\w*(Alert|Circle|Triangle|Octagon|Icon)\w*[^>]*aria-hidden/.test(box), `${label}: no aria-hidden icon beside the text`);
  }
}
check(found >= 2, `only ${found} error summaries found under ${ROOTS.join(', ')}, expected the vendor forms at least`);
console.log(`error summaries checked: ${found}`);
finish('error-summary-static');

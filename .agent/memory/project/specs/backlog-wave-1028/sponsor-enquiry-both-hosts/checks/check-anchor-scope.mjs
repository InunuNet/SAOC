// sponsor-enquiry-both-hosts, NOS anchor ruling scope guard (PIN, green when nothing has changed yet). The anchor fix may touch ONLY
// app/(nos)/national-show/nos-structure.css, and inside it only: the NOS-host --scroll-padding-top override, the comment about it
// (the one at the "Hash links land clear of the sticky header" rule), and the sponsor card's scroll-margin-top lines with the media
// query that selects them. app/globals.css must be untouched (F1a is mid-flight on it), and so must app/(marketing).
// Method: committed HEAD against the merge-base with origin/main, every added or removed line of nos-structure.css must match an allowed shape.
// Run as: node <this file> (from the checkout under test)
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const base = git('merge-base', 'origin/main', 'HEAD').trim();
const failures = [];

const untouched = git('diff', base, '--name-only', '--', 'app/globals.css', 'app/(marketing)').trim();
if (untouched) failures.push(`app/globals.css and app/(marketing) must be unchanged, but changed: ${untouched.split('\n').join(', ')}`);

const NOS = 'app/(nos)/national-show/nos-structure.css';
const ALLOWED = [
  [/--scroll-padding-top\s*:/, 'the --scroll-padding-top override'],
  [/^\s*scroll-margin-top\s*:\s*(24|68|121)px\s*;(\s*\/\*.*\*\/)?\s*$/, 'the sponsor card scroll-margin-top (24, 68 or 121px)'],
  [/^\s*@media \(min-width: 768px\) \{\s*$/, 'the card breakpoint media query (768 only)'],
  [/^\s*(html[^{]*|\.nos-theme \[data-sponsor-enquiry='nos'\])\s*\{\s*$/, 'the html NOS override or sponsor card selector line'],
  [/^\s*\}\s*$/, 'a closing brace'],
  [/^\s*$/, 'a blank line'],
];
const lines = git('diff', '-U0', base, '--', NOS).split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
// A comment is judged as a whole block: it opens with /* and runs to */ over any number of changed lines (this file's multi-line
// comments carry no leading *), and the block is allowed only if its text is about scroll-padding or scroll-margin.
const COMMENT_TOPIC = /scroll-(padding|margin)/;
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i]; const text = line.slice(1);
  if (/^\s*\/\*/.test(text)) {
    const sign = line[0]; const block = [text];
    while (!/\*\//.test(block[block.length - 1]) && i + 1 < lines.length && lines[i + 1][0] === sign) { i += 1; block.push(lines[i].slice(1)); }
    if (!/\*\//.test(block[block.length - 1])) failures.push(`${NOS} has an unterminated changed comment: ${text.trim().slice(0, 100)}`);
    else if (!COMMENT_TOPIC.test(block.join(' '))) failures.push(`${NOS} changed a comment that is not about scroll-padding or scroll-margin: ${text.trim().slice(0, 100)}`);
    continue;
  }
  const removedOldBreakpoint = line.startsWith('-') && /^\s*@media \(min-width: 700px\) \{\s*$/.test(text);
  if (!removedOldBreakpoint && !ALLOWED.some(([re]) => re.test(text))) failures.push(`${NOS} changed outside the anchor fix: ${line.trim().slice(0, 120)}`);
}
const other = git('diff', base, '--name-only', '--', 'app/(nos)/national-show/*.css', 'components/nos-chrome/*.css').split('\n').filter((f) => f && f !== NOS);
if (other.length) failures.push(`no other NOS stylesheet may change for the anchor fix: ${other.join(', ')}`);

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`PASS: anchor fix scope - globals.css untouched; nos-structure.css limited to the scroll-padding variable, its comment and the sponsor card scroll-margin (${lines.length} changed line(s))`);

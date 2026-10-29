// Scope guard (guards the dev diff): no colour literal is ADDED under app/, components/ or lib/ except the three ruled status values and the one ruled on-dark token.
// No invented colours (docs/rules/no-invention.md): everything else must reuse an existing token. Every notation is scanned: hex, rgb()/rgba(), hsl()/hsla(), oklch()/oklab()/lab()/lch()/hwb()/color() and CSS named colours.
// A functional rgb()/rgba() literal (alpha ignored) passes only when its colour already exists as a hex token in the base's app/globals.css (black and white resolve to #000000 and #ffffff); hsl()/oklch()/oklab()/lab()/lch()/hwb()/color()
// and named colours cannot be matched to a token and fail. var(...) references are never colour literals, BUT custom-property DEFINITIONS are scanned: any added `--x:` (CSS) or '--x': (JS) whose value is a bare
// colour triplet ("1 2 3" or "1, 2, 3": the rgb(var(--x)) trick), a hex, a functional colour or a named colour (rebeccapurple) must match an existing token colour, so a var() cannot launder a new colour.
import { execFileSync } from 'node:child_process';
import { check, finish } from './lib.mjs';
const ALLOWED = new Set(['#8f2834', '#2f5d3a', '#7a5a12', '#e8959d']); // #e8959d: --status-error-on-dark, NOS Design ruling (6.62:1 on #22281f), measured on that ground only
// The diff is taken against an explicit base: SDC_BASE_REF or `--base=<ref>`, defaulting to `git merge-base HEAD origin/main`. A diff against origin/main inspects nothing once the branch is merged, so an empty diff
// (0 added lines inspected) FAILS, never passes silently, unless --allow-empty is passed. The count is always printed.
const argBase = process.argv.find((a) => a.startsWith('--base='));
const base = process.env.SDC_BASE_REF || (argBase ? argBase.slice('--base='.length) : execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim());
const diff = execFileSync('git', ['diff', '-U0', base, '--', 'app', 'components', 'lib'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const hexRgb = (h) => { const x = h.slice(1); const f = x.length === 3 ? [...x].map((c) => c + c).join('') : x; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
let tokens = [];
try { tokens = [...execFileSync('git', ['show', `${base}:app/globals.css`], { encoding: 'utf8', maxBuffer: 64 << 20 }).matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => hexRgb(m[0])); } catch { tokens = []; }
tokens.push(...[...ALLOWED].map(hexRgb), [0, 0, 0], [255, 255, 255]);
const isToken = (rgb) => tokens.some((t) => t.every((v, i) => Math.abs(v - rgb[i]) <= 1));
const NAMED = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
const PROP = /(?:^|[\s{;'"(,])(?:color|background-color|background|border-color|border(?:-top|-right|-bottom|-left)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|box-shadow|text-shadow|stopColor|stop-color|backgroundColor|borderColor)\s{0,3}[:=]\s{0,3}\{?['"]?\s{0,3}(?:[^'";,]{0,40}?\s)?([a-z]+)\b/gi;
const TW = /\b(?:bg|text|border|fill|stroke|ring|outline|from|via|to|shadow|decoration|accent|caret)-\[([a-z]+)\]/gi;
let added = 0;
for (const line of diff.split('\n')) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  added++;
  const text = line.slice(1); const show = text.slice(0, 90).trim();
  for (const m of text.matchAll(/\brgba?\(([^)]{0,80})\)/gi)) {
    if (/var\(/.test(m[1])) continue;
    const nums = m[1].replace(/[\/,]/g, ' ').trim().split(/\s+/).slice(0, 3).map((x) => (/%$/.test(x) ? NaN : parseFloat(x)));
    check(!nums.some(Number.isNaN) && nums.length === 3 && isToken(nums), `added colour ${m[0]} is not an existing token colour: ${show}`);
  }
  for (const m of text.matchAll(/(--[\w-]+)['"]?\s{0,3}[:=]\s{0,3}['"]?([^;'"}{]{1,120})/g)) {
    const value = m[2].replace(/var\([^)]{0,80}\)/g, ' ').trim(); if (!value) continue;
    const trip = /^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s{0,3}\/\s{0,3}[\d.]+%?)?$/.exec(value);
    if (trip) check(trip.slice(1, 4).map(Number).every((v) => v <= 255) && isToken(trip.slice(1, 4).map(Number)), `added custom property ${m[1]}: ${value} is a colour triplet that is not an existing token colour: ${show}`);
    for (const word of value.split(/[^a-zA-Z]+/)) if (NAMED.has(word.toLowerCase())) check(false, `added custom property ${m[1]} holds the named colour "${word}": ${show}`);
  }
  for (const m of text.matchAll(/\b(?:hsla?|oklch|oklab|lab|lch|hwb|color|color-mix)\(([^)]{0,80})\)/gi)) if (!/var\(/.test(m[1]) || /color-mix/i.test(m[0])) check(false, `added colour ${m[0]} uses a notation that cannot be matched to a token: ${show}`);
  for (const re of [PROP, TW]) for (const m of text.matchAll(re)) { const nm = m[1].toLowerCase(); if (NAMED.has(nm)) check(false, `added named colour "${nm}": ${show}`); }
  for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) check(ALLOWED.has(m[0].toLowerCase()), `added colour literal ${m[0]}: ${line.slice(1, 90).trim()}`);
}
console.log(`no-new-colours: inspected ${added} added line(s) against ${base.slice(0, 12)}`);
check(added > 0 || process.argv.includes('--allow-empty'), `inspected 0 added lines against ${base.slice(0, 12)}: the diff is empty, so nothing was proven (pass --allow-empty to accept an empty diff)`);
finish('no-new-colours');

// F9 static (NOS Design #92 ruling, goldens/f9-nos-design-ruling-2026-10-25.md).
//   P1  ShowBand's countdown sits in a CSS container and re-flows 2x2 below ~360px of container: a `@container`
//       class plus a container-query variant (threshold 340-384px) that sets grid-cols-2 / grid-cols-4; the four
//       labels, the cell/value/label markup and the 34/42px and 11px type are unchanged (no copy change)
//   P2  the event detail meta <dl> is rendered only when the show band is not (gate on `show`), the band stays
//       gated on `show`, and h1 + date line are untouched
//   P3  SubmitEventPageBody wraps the form in a column centred (mx-auto) at max 640px
// Run as: node contracts/checks/polish-wave-2026-10-25/f9-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];

// P1
const band = read('components/home/ShowBand.tsx');
const classTokens = [...band.matchAll(/[^\s"'`{}<>]+/g)].map((m) => m[0]);
if (!classTokens.some((t) => /^@container(\/[\w-]+)?$/.test(t))) failures.push('P1: ShowBand has no `@container` class');
const NAMED = { xs: 320, sm: 384, md: 448 };
const queryTokens = classTokens.map((t) => {
  const m = /^@(max-)?(?:\[(\d+(?:\.\d+)?)(px|rem)\]|(xs|sm|md)):(\S+)$/.exec(t);
  if (!m) return null;
  const px = m[4] ? NAMED[m[4]] : Number(m[2]) * (m[3] === 'rem' ? 16 : 1);
  return { px, utility: m[5] };
}).filter(Boolean);
if (!queryTokens.some((q) => q.px >= 340 && q.px <= 384 && /grid-cols-[24]\b/.test(q.utility))) {
  failures.push('P1: no container-query variant between 340px and 384px that sets grid-cols-2 or grid-cols-4 (e.g. `@max-[360px]:grid-cols-2`)');
}
if (!/\bgrid-cols-2\b/.test(band)) failures.push('P1: the countdown never uses grid-cols-2');
for (const need of ["label: 'Days'", "label: 'Hours'", "label: 'Minutes'", "label: 'Seconds'", 'data-countdown-cell', 'data-countdown-value', 'text-[34px] sm:text-[42px]', 'font-mono text-[11px] uppercase tracking-[0.18em]']) {
  if (!band.includes(need)) failures.push(`P1: ShowBand lost \`${need}\` (same type, same labels, no copy change)`);
}

// P2
const page = read('app/(marketing)/events/[slug]/page.tsx');
const dl = page.indexOf('<dl');
if (dl < 0) failures.push('P2: the event meta <dl> is gone entirely (it must remain for ordinary events)');
else {
  const before = page.slice(Math.max(0, page.lastIndexOf('{/* Metadata */}', dl)), dl);
  if (!/(!show\b|show\s*\?\s*null|show\s*===?\s*null|show\s*==\s*null|!\s*show)/.test(before)) failures.push('P2: the meta <dl> is not gated on the show band being absent (`!show`)');
}
if (!/\{show \?[\s\S]{0,80}<ShowBand\b/.test(page)) failures.push('P2: <ShowBand is no longer gated on `show`');
if (!/<h1\b/.test(page) || !/formatDate\(event\.date\)/.test(page)) failures.push('P2: the h1 or the date line was removed');

// P3
const body = read('components/events/SubmitEventPageBody.tsx');
const at = body.indexOf('<SubmitEventForm');
const open = at < 0 ? '' : body.slice(body.lastIndexOf('<div', at), body.indexOf('>', body.lastIndexOf('<div', at)) + 1);
if (!open) failures.push('P3: no <div> wraps <SubmitEventForm');
else {
  if (!/\bmx-auto\b/.test(open)) failures.push(`P3: the form column is not centred (no mx-auto): ${open}`);
  if (!/(^|[\s\"'`])max-w-(\[640px\]|\[40rem\]|160)(?![\w-])/.test(open)) failures.push(`P3: the form column is not max 640px (max-w-[640px]): ${open}`);
}
finish('f9-static', failures);

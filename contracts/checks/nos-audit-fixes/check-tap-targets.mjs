// nos-audit-fixes item 3 — 44x44 CSS px tap targets (golden §3).
// /national-show/workshops and /national-show/conferences render CategoryTicketsPage ->
// TicketPurchaseForm -> TicketTypeCard (mode "buy"): per product a -/+ stepper pair and a
// quantity input, plus one submit button. DayQuantityPicker carries the identical stepper.
// /national-show/plan-your-visit renders VenueCard's "Open in a map" link.
//
// Each control must carry a box-size token that resolves to >= 44px in BOTH axes (the
// bounding box is what is measured; a pseudo-element hit area does not count), keep its
// existing type/colour classes, and the steppers keep the focus-ring token set that
// contracts/checks/tickettypecard-focus-ring-f1 counts.
//
// Run as: node contracts/checks/nos-audit-fixes/check-tap-targets.mjs
import { finish, openingTags, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-tap-targets.mjs';
const failures = [];

const H44 = ['h-11', 'h-[44px]', 'min-h-11', 'min-h-[44px]', 'size-11', 'size-[44px]'];
const W44 = ['w-11', 'w-12', 'w-[44px]', 'w-[48px]', 'min-w-11', 'min-w-[44px]', 'size-11', 'size-[44px]'];
const SMALL = ['h-8', 'w-8', 'size-8', 'h-9', 'w-9', 'h-10', 'w-10'];
const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2';

function load(rel) {
  const raw = readRepoFile(rel);
  if (!raw) {
    failures.push(`missing ${rel}`);
    return null;
  }
  return stripComments(raw);
}
function need(label, tag, { width = true, keep = [] } = {}) {
  if (!tag.className) {
    failures.push(`${label}: className must be a string literal`);
    return;
  }
  const t = tag.tokens.filter((k) => !k.includes(':')); // base (unprefixed) tokens only
  if (!t.some((k) => H44.includes(k))) failures.push(`${label}: no >=44px height token (${tag.className})`);
  if (width && !t.some((k) => W44.includes(k))) failures.push(`${label}: no >=44px width token (${tag.className})`);
  const small = t.filter((k) => SMALL.includes(k));
  if (small.length) failures.push(`${label}: still sized below 44px (${small.join(' ')})`);
  for (const k of keep) if (!tag.tokens.includes(k)) failures.push(`${label}: lost existing class ${k}`);
}

// ---- steppers: TicketTypeCard + DayQuantityPicker ----
for (const rel of ['components/tickets/TicketTypeCard.tsx', 'components/tickets/DayQuantityPicker.tsx']) {
  const src = load(rel);
  if (!src) continue;
  const buttons = openingTags(src, 'button');
  if (buttons.length !== 2) failures.push(`${rel}: expected the 2 stepper <button>s, found ${buttons.length}`);
  buttons.forEach((b, i) =>
    need(`${rel} stepper button ${i + 1}`, b, { keep: ['rounded-sm', 'border', 'border-rule', 'text-[16px]', 'text-ink'] }),
  );
  const inputs = openingTags(src, 'input').filter((t) => /type="number"/.test(t.text));
  if (inputs.length !== 1) failures.push(`${rel}: expected 1 quantity <input type="number">, found ${inputs.length}`);
  inputs.forEach((t) => need(`${rel} quantity input`, t, { keep: ['text-center', 'text-[15px]', 'border-rule', 'bg-ivory'] }));
  const ringCount = src.split(RING).length - 1;
  const wantRing = rel.endsWith('TicketTypeCard.tsx') ? 3 : 2;
  if (ringCount !== wantRing) failures.push(`${rel}: focus-ring token set must appear ${wantRing}x, found ${ringCount}`);
}

// ---- submit button: TicketPurchaseForm ----
{
  const rel = 'components/tickets/TicketPurchaseForm.tsx';
  const src = load(rel);
  if (src) {
    const submits = openingTags(src, 'button').filter((t) => /type="submit"/.test(t.text));
    if (submits.length !== 1) failures.push(`${rel}: expected 1 submit <button>, found ${submits.length}`);
    submits.forEach((t) =>
      need(`${rel} submit button`, t, { width: false, keep: ['bg-accent', 'px-5', 'text-[14px]', 'font-medium', 'text-ivory'] }),
    );
  }
}

// ---- "Open in a map": VenueCard ----
{
  const rel = 'components/show/VenueCard.tsx';
  const src = load(rel);
  if (src) {
    const links = openingTags(src, 'a').filter((t) => /href=\{venue\.mapsUrl\}/.test(t.text));
    if (links.length !== 1) failures.push(`${rel}: expected 1 <a href={venue.mapsUrl}>, found ${links.length}`);
    for (const a of links) {
      need(`${rel} "Open in a map" link`, a, {
        width: false,
        keep: ['mt-5', 'font-mono', 'text-[12px]', 'tracking-[0.16em]', 'text-ink', 'underline', 'underline-offset-4', 'hover:text-accent'],
      });
      // inline-flex + items-center: min-height applies AND the text stays vertically centred
      // in the 44px box. inline-block would grow the box downward with the text pinned to its top.
      const display = a.tokens.filter((k) => ['inline-flex', 'flex', 'inline-block', 'block', 'inline-grid', 'grid'].includes(k));
      if (display.join() !== 'inline-flex') failures.push(`${rel}: the link's display must be exactly inline-flex, got [${display.join(' ')}]`);
      if (!a.tokens.includes('items-center')) failures.push(`${rel}: the link must carry items-center so the text stays centred in the 44px box`);
    }
    if (!/Open in a map ↗/.test(src)) failures.push(`${rel}: link text "Open in a map ↗" must be unchanged`);
  }
}

finish(NAME, failures, 'steppers, quantity inputs, submit button and "Open in a map" are all >=44px, existing visual classes and focus rings kept.');

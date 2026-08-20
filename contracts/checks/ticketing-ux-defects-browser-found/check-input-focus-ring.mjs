// A2 — every focusable <input> on /tickets must gain a genuinely VISIBLE keyboard focus
// indicator, consistent with the ring the +/- stepper buttons already render (neither
// stepper button overrides `outline`, so the browser's native `:focus-visible` ring shows
// through unmodified — that is the existing, working precedent this check holds inputs
// to, per the architect brief: "make <input> elements CONSISTENT with that existing,
// working precedent — not introduce a new visual language").
//
// WHY A REAL BROWSER, DRIVEN BY A REAL Tab KEYPRESS, NOT A SOURCE GREP AND NOT `.focus()`
// A grep for `focus-visible:` or the absence of `outline-none` in a className string
// proves a class was WRITTEN, not that a ring RENDERS — this project's own dominant,
// repeatedly-confirmed defect class ("assertion satisfiable by something that isn't the
// real property", `.agent/memory/project/learned.md`). This check launches a real
// Chromium instance (same convention as
// contracts/checks/partners-cards/check-overflow-375.mjs) and drives focus with a
// GENUINE `page.keyboard.press('Tab')`, not `element.focus()`. This distinction is
// load-bearing and was found the hard way while producing this check's own red evidence:
// Chromium's `:focus-visible` heuristic is keyed off recent INPUT MODALITY — a real Tab
// keypress always shows the native ring on the newly focused element, but a JS
// `element.focus()` call, run after ANY prior mouse click on the page (e.g. clicking the
// quantity stepper to reach an attendee field), is treated as non-keyboard and suppresses
// the ring EVEN ON already-correct elements (the -/+ stepper buttons themselves briefly
// false-failed this way during authoring). Only a real keypress reproduces what a
// keyboard-only buyer actually experiences.
//
// WHY outlineStyle SPECIFICALLY, NOT ALSO ACCEPTING A BORDER-COLOR CHANGE
// The attendee name/email <input> (TicketFormField.tsx) already carries a
// `focus:border-ink/40` class, and its computed `border-color` DOES numerically change on
// focus (confirmed live: unfocused rgb(217,215,201) -> focused oklab ~0.4-opacity tint).
// A check that accepted ANY of {outline changed, box-shadow changed, border-color
// changed} would therefore already pass TODAY, on the unmodified tree, for the attendee
// field specifically — proving nothing, the exact "already-satisfiable assertion" trap
// this project's own audit exists to catch. The architect brief's own zoomed-screenshot
// evidence is that this subtle border tint is NOT a visually crisp indicator a keyboard
// user can rely on; the fix specified here is to stop suppressing the native outline
// (delete `outline-none` from both affected inputs), which is the SAME mechanism the
// stepper buttons already rely on, so `outlineStyle !== 'none'` after a real Tab keypress
// is the correct, non-satisfiable-by-accident bar for both the quantity input and the
// attendee inputs.
//
// Run as: npx tsx contracts/checks/ticketing-ux-defects-browser-found/check-input-focus-ring.mjs

import { chromium } from 'playwright';

const BASE_URL = process.env.TICKETING_UX_CHECK_BASE_URL ?? 'http://localhost:3002';
const MAX_TABS = 60;
const failures = [];

async function activeElementInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      type: el instanceof HTMLInputElement ? el.type : null,
      id: el.id,
      ariaLabel: el.getAttribute('aria-label'),
      outlineStyle: cs.outlineStyle,
    };
  });
}

// Presses Tab repeatedly (a REAL keyboard event each time, never `.focus()`) until the
// active element satisfies `predicate`, or MAX_TABS is exceeded. Returns the matching
// element's info, or null if never found — a null result is itself a check failure
// (the target field must be keyboard-reachable at all).
async function tabUntil(page, predicate) {
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const info = await activeElementInfo(page);
    if (info && predicate(info)) return info;
  }
  return null;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE_URL}/tickets`, { waitUntil: 'networkidle' });

// Case 1 — Tab all the way to the first ticket type's quantity <input type=number>
// (TicketTypeCard.tsx), the real path a keyboard-only buyer takes.
const qtyInfo = await tabUntil(page, (el) => el.tag === 'INPUT' && el.type === 'number');
if (!qtyInfo) {
  failures.push('(1) SETUP FAILURE: could not Tab to any quantity <input> within 60 presses');
} else if (qtyInfo.outlineStyle === 'none') {
  failures.push(
    `(1) quantity <input id="${qtyInfo.id}"> shows NO visible focus outline after a real Tab keypress — ` +
      `computed outlineStyle="none" (expected anything other than "none", matching the -/+ stepper ` +
      `buttons' own unmodified native ring)`
  );
}

// Case 2 — the -/+ stepper button immediately after the quantity input, as a negative
// control / regression guard IN THE SAME TAB SEQUENCE: proves the fix to the <input>
// elements does not accidentally alter the buttons' own already-working focus behaviour
// (they are not touched by this contract's fix), using the exact same Tab-driven method
// as case 1 so the two are directly comparable.
const buttonInfo = await tabUntil(page, (el) => el.tag === 'BUTTON' && el.ariaLabel?.startsWith('Increase quantity of'));
if (!buttonInfo) {
  failures.push('(2) SETUP FAILURE: could not Tab to the "Increase quantity of" stepper button within 60 presses');
} else if (buttonInfo.outlineStyle === 'none') {
  failures.push(
    `(2) NEGATIVE CONTROL FAILED: the +/- stepper button's own native focus outline is "none" after a real ` +
      `Tab keypress — this button is not in scope for this contract's fix and must be unaffected`
  );
}

// Case 3 — an attendee name <input> (TicketFormField.tsx via CartAttendeeFields), reached
// by first clicking the same stepper button (mouse, incidental setup only — not part of
// the assertion) to reveal the row, then Tabbing to it with real keypresses.
await page.locator('button[aria-label^="Increase quantity of"]').first().click();
await page.evaluate(() => document.activeElement?.blur());
const attendeeInfo = await tabUntil(
  page,
  (el) => el.tag === 'INPUT' && el.id.startsWith('attendee-') && el.id.endsWith('-name')
);
if (!attendeeInfo) {
  failures.push('(3) SETUP FAILURE: could not Tab to any attendee name <input> within 60 presses');
} else if (attendeeInfo.outlineStyle === 'none') {
  failures.push(
    `(3) attendee name <input id="${attendeeInfo.id}"> shows NO visible focus outline after a real Tab ` +
      `keypress — computed outlineStyle="none" (the existing focus:border-ink/40 border-color tint does ` +
      `not satisfy this check — see file header "WHY outlineStyle SPECIFICALLY")`
  );
}

await browser.close();

console.log(JSON.stringify({ qtyInfo, buttonInfo, attendeeInfo }, null, 2));

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
process.exit(0);

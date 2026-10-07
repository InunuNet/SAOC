// F6 (conference-workshop-tickets, M4) — A1: lib/view-models/ticket-card.ts exists and
// exports TicketCardState, ScarcityLine, TicketCardViewModel, PresenterCardViewModel,
// WorkshopSessionViewModel, LOW_STOCK_THRESHOLD_PERCENT — per the golden §1.
//
// `TicketCardState`/`ScarcityLine`/`TicketCardViewModel`/`PresenterCardViewModel`/
// `WorkshopSessionViewModel` are TypeScript types/interfaces — they erase entirely at
// runtime, so there is nothing to import and check with `in`. They're verified by
// inspecting the SOURCE TEXT for an `export type <Name>` or `export interface <Name>`
// declaration, exactly as check-provenance-no-initial-value.mjs (F3) inspects schema
// source text rather than importing a build-time-only module. `LOW_STOCK_THRESHOLD_PERCENT`
// is a real runtime value, so it's checked functionally by importing the module and
// reading it (A2's sibling grep already pins its value to 10 — this just confirms it's a
// genuine export, not merely grep-matchable text elsewhere in the file).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRepoModule, finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/view-models/ticket-card.ts';
const failures = [];

let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', REL_PATH), 'utf8');
} catch (error) {
  finish('check-view-model-exports.mjs', [`could not read ${REL_PATH}: ${error.message}`]);
  process.exit(1);
}

const TYPE_EXPORTS = [
  { name: 'TicketCardState', pattern: /export\s+type\s+TicketCardState\b/ },
  { name: 'ScarcityLine', pattern: /export\s+interface\s+ScarcityLine\b/ },
  { name: 'TicketCardViewModel', pattern: /export\s+interface\s+TicketCardViewModel\b/ },
  { name: 'PresenterCardViewModel', pattern: /export\s+interface\s+PresenterCardViewModel\b/ },
  { name: 'WorkshopSessionViewModel', pattern: /export\s+interface\s+WorkshopSessionViewModel\b/ },
];

for (const { name, pattern } of TYPE_EXPORTS) {
  if (!pattern.test(source)) {
    failures.push(`no 'export type/interface ${name}' declaration found in ${REL_PATH}`);
  }
}

// LOW_STOCK_THRESHOLD_PERCENT is a real value — check it's importable, not just grep-matched
// text (a comment mentioning the name would satisfy a bare grep but not a real import).
try {
  const mod = await loadRepoModule(REL_PATH);
  if (typeof mod.LOW_STOCK_THRESHOLD_PERCENT !== 'number') {
    failures.push(
      `LOW_STOCK_THRESHOLD_PERCENT is not a real numeric export of ${REL_PATH} (got ${typeof mod.LOW_STOCK_THRESHOLD_PERCENT})`,
    );
  } else if (mod.LOW_STOCK_THRESHOLD_PERCENT !== 10) {
    failures.push(`LOW_STOCK_THRESHOLD_PERCENT is ${mod.LOW_STOCK_THRESHOLD_PERCENT}, expected 10`);
  }
} catch (error) {
  failures.push(`could not import ${REL_PATH} to check LOW_STOCK_THRESHOLD_PERCENT: ${error.message}`);
}

finish(
  'check-view-model-exports.mjs',
  failures,
  `${REL_PATH} exports all five view-model types and a real LOW_STOCK_THRESHOLD_PERCENT === 10.`,
);

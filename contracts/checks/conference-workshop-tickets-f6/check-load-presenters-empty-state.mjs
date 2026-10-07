// F6 (conference-workshop-tickets, M4) — A6: loadPresenterViewModels queries
// conferencePresenter filtered by event, ordered by order, and returns an empty array
// (not an error, not a fabricated entry) when none are seeded (golden §2) — the real,
// current state, since no conferencePresenter documents exist in the dataset yet.
//
// Proven two ways: (1) STRUCTURAL — the GROQ query string filters on
// `_type == "conferencePresenter"`, an `event ==` equality, and `order(order` ascending;
// (2) FUNCTIONAL/LIVE — calling the real, unmodified loader against the real configured
// Sanity dataset (read-only GROQ fetch, no mutation) for both event values returns a real
// array, never throws, and — matching today's actual unseeded state — is empty. A live
// read is safe per this project's own Sanity-dataset convention (read-only queries don't
// touch the "careful method" that only applies to writes).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRepoModule, finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/view-models/load-presenters.ts';
const failures = [];

let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', REL_PATH), 'utf8');
} catch (error) {
  finish('check-load-presenters-empty-state.mjs', [`could not read ${REL_PATH}: ${error.message}`]);
  process.exit(1);
}

if (!/conferencePresenter/.test(source)) {
  failures.push(`${REL_PATH} does not reference the 'conferencePresenter' document type`);
}
if (!/event\s*==/.test(source)) {
  failures.push(`${REL_PATH} does not filter the GROQ query by 'event =='`);
}
if (!/order\s*\(\s*order/.test(source)) {
  failures.push(`${REL_PATH} does not order the GROQ query by 'order(order ...)'`);
}

if (failures.length === 0) {
  try {
    const { loadPresenterViewModels } = await loadRepoModule(REL_PATH);
    if (typeof loadPresenterViewModels !== 'function') {
      failures.push(`${REL_PATH} does not export a loadPresenterViewModels function`);
    } else {
      for (const event of ['saoc-symposium', 'wosa-conference']) {
        let result;
        try {
          result = await loadPresenterViewModels(event);
        } catch (error) {
          failures.push(`loadPresenterViewModels('${event}') threw ${error.message} — must return an empty array, never throw, when none are seeded`);
          continue;
        }
        if (!Array.isArray(result)) {
          failures.push(`loadPresenterViewModels('${event}') returned ${JSON.stringify(result)}, expected an array`);
        } else if (result.length !== 0) {
          // Not necessarily a failure of THIS feature (a presenter may have been seeded
          // since this check was authored) — but flag it loudly for human attention rather
          // than silently assuming the fixture is the live state.
          console.log(
            `NOTE: loadPresenterViewModels('${event}') returned ${result.length} entr${result.length === 1 ? 'y' : 'ies'} — dataset is no longer empty; the real-array/no-throw property still held.`,
          );
        }
      }
    }
  } catch (error) {
    failures.push(`could not import/run ${REL_PATH}: ${error.message}`);
  }
}

finish(
  'check-load-presenters-empty-state.mjs',
  failures,
  `${REL_PATH} queries conferencePresenter filtered by event and ordered by order, returning a real array (empty when unseeded) rather than throwing.`,
);

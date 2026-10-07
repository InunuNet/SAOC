// F6 (conference-workshop-tickets, M4) — A7: loadWorkshopSessionViewModels queries
// workshopSession and resolves each session's linked ticketType through
// loadTicketCardViewModel, returning an empty array when none exist (golden §2) — the
// real, current state, since no workshopSession documents are council-confirmed yet.
//
// Proven the same two ways as A6's sibling check: STRUCTURAL (GROQ query references
// 'workshopSession' and the loader imports/calls loadTicketCardViewModel from its sibling
// module, rather than re-deriving a ticket card shape by hand) and FUNCTIONAL/LIVE (the
// real, unmodified loader against the real configured Sanity dataset returns a real array,
// never throws, and is empty today).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRepoModule, finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/view-models/load-workshop-sessions.ts';
const failures = [];

let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', REL_PATH), 'utf8');
} catch (error) {
  finish('check-load-workshop-sessions-empty-state.mjs', [`could not read ${REL_PATH}: ${error.message}`]);
  process.exit(1);
}

if (!/workshopSession/.test(source)) {
  failures.push(`${REL_PATH} does not reference the 'workshopSession' document type`);
}

const sourceNoComments = source
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');
if (!/import\s*\{[^}]*\bloadTicketCardViewModel\b[^}]*\}\s*from/.test(sourceNoComments)) {
  failures.push(`${REL_PATH} does not import loadTicketCardViewModel — each session's linked ticketType must resolve through it, not a re-derived shape`);
} else if (!/loadTicketCardViewModel\s*\(/.test(sourceNoComments)) {
  failures.push(`${REL_PATH} imports loadTicketCardViewModel but never calls it`);
}

if (failures.length === 0) {
  try {
    const { loadWorkshopSessionViewModels } = await loadRepoModule(REL_PATH);
    if (typeof loadWorkshopSessionViewModels !== 'function') {
      failures.push(`${REL_PATH} does not export a loadWorkshopSessionViewModels function`);
    } else {
      let result;
      try {
        result = await loadWorkshopSessionViewModels();
      } catch (error) {
        failures.push(`loadWorkshopSessionViewModels() threw ${error.message} — must return an empty array, never throw, when none exist`);
      }
      if (result !== undefined) {
        if (!Array.isArray(result)) {
          failures.push(`loadWorkshopSessionViewModels() returned ${JSON.stringify(result)}, expected an array`);
        } else if (result.length !== 0) {
          console.log(
            `NOTE: loadWorkshopSessionViewModels() returned ${result.length} entr${result.length === 1 ? 'y' : 'ies'} — dataset is no longer empty; the real-array/no-throw property still held.`,
          );
        }
      }
    }
  } catch (error) {
    failures.push(`could not import/run ${REL_PATH}: ${error.message}`);
  }
}

finish(
  'check-load-workshop-sessions-empty-state.mjs',
  failures,
  `${REL_PATH} queries workshopSession and resolves each session's ticketType through loadTicketCardViewModel, returning a real array (empty when unseeded) rather than throwing.`,
);

// Structural check that regularPrice is selected alongside price in every ticketType-reading
// GROQ query this feature touches (contracts/golden/ticketing-flow-redesign-f1/
// pricing-model.golden.md "sanity/queries.ts").
import { readFileSync } from 'node:fs';

const src = readFileSync('sanity/queries.ts', 'utf8');

const QUERY_NAMES = [
  'activeTicketTypesQuery',
  'activeTicketTypesByCategoryQuery',
  'ticketTypeBySlugQuery',
];

let failed = false;
for (const name of QUERY_NAMES) {
  const declIndex = src.indexOf(`export const ${name}`);
  if (declIndex === -1) {
    console.error(`FAIL: ${name} not found in sanity/queries.ts`);
    failed = true;
    continue;
  }
  // Query body ends at the closing backtick following the declaration.
  const bodyStart = src.indexOf('`', declIndex);
  const bodyEnd = src.indexOf('`', bodyStart + 1);
  const body = src.slice(bodyStart, bodyEnd);
  if (!/\bregularPrice\b/.test(body)) {
    console.error(`FAIL: ${name} does not select regularPrice`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('PASS: all three ticketType-reading queries select regularPrice.');

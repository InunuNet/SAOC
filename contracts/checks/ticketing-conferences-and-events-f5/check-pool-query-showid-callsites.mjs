// F5 (ticketing-conferences-and-events, M2) — third Codex GPT-5.5 defect repair (2026-08-21):
// companion to check-ui-query-regression-guards.mjs's proof that ticketTypesByPoolQuery's GROQ
// body itself filters on `show._ref == $showId`. That proof alone is not sufficient: GROQ params
// left unbound by a caller do not error, they silently fail to filter (an unbound $showId makes
// `show._ref == $showId` compare against `null`, matching nothing — not "any show", but a
// distinct failure mode from the query definition being wrong, and one the GROQ-body check cannot
// see). This proves BOTH real call sites actually pass a `showId:` param when invoking
// ticketTypesByPoolQuery:
//   1. app/api/tickets/checkout/route.ts — the client.fetch(ticketTypesByPoolQuery, { ... }) call.
//   2. components/tickets/CategoryTicketsPage.tsx — the sanityFetch({ query: ticketTypesByPoolQuery,
//      params: { ... } }) call.
//
// Extracts each call's own argument object (brace-matched from the call site, not a fixed line
// window) and requires a `showId` key bound to a real identifier/expression (not a literal
// `undefined`), so a future refactor that drops the param — or unbinds it — fails this check.
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-pool-query-showid-callsites.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROUTE_FILE = process.env.F5_CHECK_ROUTE_FILE_OVERRIDE
  ? path.resolve(process.env.F5_CHECK_ROUTE_FILE_OVERRIDE)
  : path.resolve(__dirname, '../../../app/api/tickets/checkout/route.ts');

const CATEGORY_PAGE_FILE = process.env.F5_CHECK_CATEGORY_PAGE_FILE_OVERRIDE
  ? path.resolve(process.env.F5_CHECK_CATEGORY_PAGE_FILE_OVERRIDE)
  : path.resolve(__dirname, '../../../components/tickets/CategoryTicketsPage.tsx');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function readSource(filePath, label) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    fail(`${label} (${filePath}) does not exist.`);
  }
}

// Strips // line comments and /* */ block comments without touching string/template contents,
// so a commented-out param can never satisfy the check.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// Finds the invocation of `ticketTypesByPoolQuery` at `usageIdx` and brace/paren-matches outward
// to the enclosing call's full argument list text, so the extracted text is exactly what's passed
// to that specific call — not some other object elsewhere in the file that happens to contain
// `showId`.
function extractCallArgs(src, usageIdx, label) {
  // Walk backward from usageIdx to the nearest unmatched '(' that opens this call's arg list.
  let depth = 0;
  let openParenIdx = -1;
  for (let i = usageIdx; i >= 0; i--) {
    const ch = src[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) {
        openParenIdx = i;
        break;
      }
      depth--;
    }
  }
  if (openParenIdx === -1) {
    fail(`${label}: could not find the enclosing call's opening parenthesis for ticketTypesByPoolQuery.`);
  }
  // Walk forward from openParenIdx to its matching ')'.
  depth = 0;
  let closeParenIdx = -1;
  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        closeParenIdx = i;
        break;
      }
    }
  }
  if (closeParenIdx === -1) {
    fail(`${label}: could not find the enclosing call's closing parenthesis for ticketTypesByPoolQuery.`);
  }
  return src.slice(openParenIdx + 1, closeParenIdx);
}

function requireBoundShowId(argsText, label) {
  const match = argsText.match(/\bshowId\s*:\s*([A-Za-z0-9_.?()[\]]+)/);
  if (!match) {
    fail(
      `${label}: the call to ticketTypesByPoolQuery does not pass a "showId" param. GROQ params ` +
        'left unbound do not error — they silently fail to filter, letting pool siblings be ' +
        'matched across ALL shows (Defect 3, 2026-08-21) regardless of the query\'s own ' +
        '`show._ref == $showId` filter.'
    );
  }
  const value = match[1].trim();
  if (value === 'undefined') {
    fail(`${label}: "showId" is explicitly bound to undefined — same silent-no-filter failure as omitting it.`);
  }
}

// --- Call site 1: app/api/tickets/checkout/route.ts ---
{
  const raw = readSource(ROUTE_FILE, 'checkout route');
  const src = stripComments(raw);
  // The import statement also contains the literal "ticketTypesByPoolQuery," — anchor the
  // search to the client.fetch(...) call itself so we land on the real usage, not the import.
  const fetchCallIdx = src.indexOf('client.fetch');
  if (fetchCallIdx === -1) {
    fail('app/api/tickets/checkout/route.ts no longer calls client.fetch(...).');
  }
  const usageIdx = src.indexOf('ticketTypesByPoolQuery,', fetchCallIdx);
  if (usageIdx === -1) {
    fail('app/api/tickets/checkout/route.ts no longer calls client.fetch(ticketTypesByPoolQuery, ...).');
  }
  const argsText = extractCallArgs(src, usageIdx, 'app/api/tickets/checkout/route.ts');
  requireBoundShowId(argsText, 'app/api/tickets/checkout/route.ts');
}

// --- Call site 2: components/tickets/CategoryTicketsPage.tsx ---
{
  const raw = readSource(CATEGORY_PAGE_FILE, 'CategoryTicketsPage');
  const src = stripComments(raw);
  const usageIdx = src.indexOf('query: ticketTypesByPoolQuery');
  if (usageIdx === -1) {
    fail(
      'components/tickets/CategoryTicketsPage.tsx no longer calls sanityFetch({ query: ' +
        'ticketTypesByPoolQuery, ... }).'
    );
  }
  const argsText = extractCallArgs(src, usageIdx, 'components/tickets/CategoryTicketsPage.tsx');
  requireBoundShowId(argsText, 'components/tickets/CategoryTicketsPage.tsx');
}

console.log(
  'PASS: both ticketTypesByPoolQuery call sites (checkout route + CategoryTicketsPage) pass a ' +
    'bound showId param.'
);
process.exit(0);

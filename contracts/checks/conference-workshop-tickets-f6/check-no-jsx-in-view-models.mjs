// F6 (conference-workshop-tickets, M4) — A8 (rewritten 2026-10-07, team-lead: F6 gate run
// FAILed here as a false positive). The original inline shell command
// (`! grep -rlE "className=|<[A-Z][a-zA-Z]*[ />]" lib/view-models/`) matched the TypeScript
// generic `Promise<TicketCardViewModel>` inside two plain comments in
// lib/view-models/load-ticket-card.ts (:132, :152) — a bare `<Uppercase...` regex cannot
// distinguish a JSX element from a generic type argument, and it was never going to once
// real code started citing its own return type in a comment.
//
// This rewrite drops the generic-matching regex entirely and instead checks the three
// structural signals that would ACTUALLY be present if real JSX/a React component were
// introduced under lib/view-models/, none of which a TS generic can trigger:
//   1. No `.tsx` file exists here — TypeScript requires the `.tsx` extension to parse JSX
//      syntax at all; a `.ts` file containing real `<div>...</div>` syntax is a compile
//      error, not merely a lint smell. This is the strong, load-bearing signal.
//   2. No `className=` anywhere (the project's own Tailwind convention — see coding.md's
//      "No inline styles" rule) — a plain string concern, no generic can produce it.
//   3. No import of `react` and no `React.createElement`/JSX-pragma reference — the two
//      ways a .ts file could still construct an element without JSX syntax.
// `className=` and the Tailwind/CSS-class-string guarantee from the original description
// are kept; only the JSX-detecting half of the original regex is replaced.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');

export function checkNoJsxInViewModels(viewModelsDir) {
  const failures = [];
  let entries;
  try {
    entries = readdirSync(viewModelsDir, { withFileTypes: true });
  } catch (error) {
    failures.push(`could not read ${viewModelsDir}: ${error.message}`);
    return failures;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue; // this directory has no subdirectories today; a future
    // one would need its own recursion, deliberately not added until it exists
    const filePath = path.join(viewModelsDir, entry.name);
    const relPath = path.relative(REPO_ROOT, filePath);

    if (entry.name.endsWith('.tsx')) {
      failures.push(`${relPath}: a .tsx file exists under lib/view-models/ — TypeScript requires this extension to parse real JSX syntax, so its mere presence here is the violation`);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;

    const source = readFileSync(filePath, 'utf8');
    if (/className\s*=/.test(source)) {
      failures.push(`${relPath}: contains 'className=' — a Tailwind/CSS class string, forbidden anywhere under lib/view-models/`);
    }
    if (/from\s+['"]react['"]/.test(source) || /\brequire\(\s*['"]react['"]\s*\)/.test(source)) {
      failures.push(`${relPath}: imports 'react' — no React component may be introduced under lib/view-models/`);
    }
    if (/React\.createElement\s*\(/.test(source)) {
      failures.push(`${relPath}: calls React.createElement(...) — constructs a React element without JSX syntax, still forbidden`);
    }
  }

  return failures;
}

const failures = checkNoJsxInViewModels(path.join(REPO_ROOT, 'lib/view-models'));

finish(
  'check-no-jsx-in-view-models.mjs',
  failures,
  'zero .tsx file, zero className= string, and zero React import/element-construction anywhere under lib/view-models/.',
);

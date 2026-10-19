// F30-A6 - the checks themselves can never mutate live Sanity or Firestore: no client constructor, no admin SDK
// handle, no token read, no network call anywhere under contracts/checks/launch-weekend/f30/.
// Run from the repo root: node contracts/checks/launch-weekend/f30/check-g-no-live-client.mjs
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'contracts/checks/launch-weekend/f30';
const SKIP = new Set(['check-g-no-live-client.mjs', 'check-d-static.mjs']); // check-d only READS source text and names these tokens as patterns
const FORBIDDEN = [/createClient\s*\(/, /getFirestore\s*\(/, /initAdmin\s*\(/, /process\.env\.SANITY/, /SANITY_API/, /\bfetch\s*\(/, /sanity\.io/, /from\s+['"]@sanity\/client['"]/];
const problems = [];
for (const f of readdirSync(DIR).filter((n) => !SKIP.has(n) && /\.(mjs|mts)$/.test(n))) {
  const body = readFileSync(`${DIR}/${f}`, 'utf8').replace(/\/\/.*$/gm, '');
  for (const re of FORBIDDEN) if (re.test(body)) problems.push(`${f} matches ${re}`);
}
if (problems.length > 0) { console.error(`FAIL F30-A6:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('PASS F30-A6 checks are offline (no live client, token or network)');

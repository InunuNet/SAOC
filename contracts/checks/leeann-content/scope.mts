// leeann-content-build scope guard. Usage: pnpm exec tsx contracts/checks/leeann-content/scope.mts m1|m2
// Every file changed since the architect's base commit (goldens/scope/base-commit.txt, else the merge-base
// with origin/main; LEEANN_BASE overrides both) must match the milestone allow-list. Three more rules:
//   - goldens and the checks in contracts/checks/leeann-content are QA inputs: @dev never edits them;
//   - a pre-existing check under contracts/checks/, e2e/ or tests/ may be edited only when it is named in
//     checks-updated.md with the reason (an old assertion that pinned copy Lee-Ann has now replaced);
//   - staged, unstaged, committed and untracked changes all count (AGENTS.md excepted: `next dev` rewrites it).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { GOLDENS, SPEC, fail, finish } from './lib.mts';

const milestone = process.argv[2];
if (milestone !== 'm1' && milestone !== 'm2') {
  console.error('usage: scope.mts m1|m2');
  process.exit(2);
}

const git = (args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

function baseCommit(): string {
  if (process.env.LEEANN_BASE) return process.env.LEEANN_BASE;
  const recorded = `${GOLDENS}/scope/base-commit.txt`;
  if (existsSync(recorded)) return readFileSync(recorded, 'utf8').trim();
  return git(['merge-base', 'HEAD', 'origin/main']);
}

function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      source += '.*';
      i++;
    } else if (char === '*') source += '[^/]*';
    else source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

const allow = (JSON.parse(readFileSync(`${GOLDENS}/scope/${milestone}.json`, 'utf8')) as { allow: string[] }).allow.map(globToRegExp);
const base = baseCommit();
const changed = new Set<string>([
  ...git(['diff', '--name-only', '--no-renames', base]).split('\n'),
  ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
].filter(Boolean));

const protectedGoldens = [/^\.agent\/memory\/project\/specs\/.*\/goldens\//, /^contracts\/checks\/leeann-content\//];
const listedOnly = [/^contracts\/checks\//, /^e2e\//, /^tests\//];
const notePath = `${SPEC}/checks-updated.md`;
const note = existsSync(notePath) ? readFileSync(notePath, 'utf8') : '';

for (const file of [...changed].sort()) {
  if (file === 'AGENTS.md') continue; // `next dev` re-appends its agent-rules block to it on every start
  if (protectedGoldens.some((re) => re.test(file))) {
    fail(`${file}: goldens and leeann-content checks are QA inputs, not @dev's to edit`);
  } else if (file === `${SPEC}/contract-f1.yaml` || /^\.agent\/memory\/project\/specs\/leeann-content-build\/contract-f\d\.yaml$/.test(file)) {
    fail(`${file}: the contract is the architect's`);
  } else if (listedOnly.some((re) => re.test(file))) {
    if (!note.includes(file)) fail(`${file}: an existing check may change only when ${notePath} names it with the reason`);
  } else if (!allow.some((re) => re.test(file))) {
    fail(`${file}: outside the ${milestone} allow-list`);
  }
}
console.log(`scope ${milestone}: ${changed.size} changed file(s) since ${base.slice(0, 10)}`);
finish(`scope ${milestone}`);

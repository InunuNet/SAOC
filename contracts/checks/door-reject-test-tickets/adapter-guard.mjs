// F4 adapter guard (SEC-06). Two static checks that tie the stamp to what the payment adapters really do.
//   node adapter-guard.mjs coupling [root]      the adapter-owned sandbox constants, the stamp and IsTest agree
//   node adapter-guard.mjs diff [diffFile]      the only lib/payments change is the two exported constants and IsTest reading the flag
// Exit 0 pass, 1 fail with reasons on stderr. adapter-mutation.mjs proves both checks bite.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const OZOW = 'lib/payments/ozow.ts';
const PAYFAST = 'lib/payments/payfast.ts';
const ISSUANCE = 'lib/ticket-issuance-mode.ts';
const ALLOWED_REMOVED = ["const OZOW_IS_TEST = 'true';"];
const REQUIRED_ADDED = [
  'export const OZOW_SANDBOX_MODE = true;',
  'const OZOW_IS_TEST = String(OZOW_SANDBOX_MODE);',
  'export const PAYFAST_SANDBOX_MODE = true;',
];

export function checkCoupling(read) {
  const errors = [];
  const issuance = read(ISSUANCE), ozow = read(OZOW), payfast = read(PAYFAST);
  if (!/^export const PAYMENT_GATEWAYS_SANDBOX_ONLY = OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;$/m.test(issuance)) errors.push(`${ISSUANCE}: PAYMENT_GATEWAYS_SANDBOX_ONLY must be exactly OZOW_SANDBOX_MODE || PAYFAST_SANDBOX_MODE (no hand-set flag)`);
  if (!/import\s*\{[^}]*\bOZOW_SANDBOX_MODE\b[^}]*\}\s*from\s*'@\/lib\/payments\/ozow'/.test(issuance)) errors.push(`${ISSUANCE}: must import OZOW_SANDBOX_MODE from '@/lib/payments/ozow'`);
  if (!/import\s*\{[^}]*\bPAYFAST_SANDBOX_MODE\b[^}]*\}\s*from\s*'@\/lib\/payments\/payfast'/.test(issuance)) errors.push(`${ISSUANCE}: must import PAYFAST_SANDBOX_MODE from '@/lib/payments/payfast'`);
  const ozowFlag = ozow.match(/^export const OZOW_SANDBOX_MODE = (true|false);$/m);
  const payfastFlag = payfast.match(/^export const PAYFAST_SANDBOX_MODE = (true|false);$/m);
  if (!ozowFlag) errors.push(`${OZOW}: export const OZOW_SANDBOX_MODE missing`);
  if (!payfastFlag) errors.push(`${PAYFAST}: export const PAYFAST_SANDBOX_MODE missing`);
  if (!/^const OZOW_IS_TEST = String\(OZOW_SANDBOX_MODE\);$/m.test(ozow)) errors.push(`${OZOW}: OZOW_IS_TEST must read OZOW_SANDBOX_MODE`);
  if (!/IsTest: OZOW_IS_TEST,/.test(ozow)) errors.push(`${OZOW}: the initiate payload must send IsTest: OZOW_IS_TEST`);
  // A flag that says live while the adapter still names sandbox hosts, URLs or credentials is a lie.
  if (ozowFlag?.[1] === 'false' && /OZOW_SANDBOX_(?!MODE\b)[A-Z_]+/.test(ozow)) errors.push(`${OZOW}: OZOW_SANDBOX_MODE is false but the adapter still uses OZOW_SANDBOX_* credentials`);
  if (payfastFlag?.[1] === 'false' && /PAYFAST_SANDBOX_(?!MODE\b)[A-Z_]+/.test(payfast)) errors.push(`${PAYFAST}: PAYFAST_SANDBOX_MODE is false but the adapter still uses the PayFast sandbox URLs or credentials`);
  return errors;
}

export function checkDiff(diffText) {
  const errors = [];
  const files = new Set();
  const added = [], removed = [];
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const name = line.slice(4).replace(/^[ab]\//, '');
      if (name !== '/dev/null') files.add(name);
    } else if (line.startsWith('+')) added.push(line.slice(1));
    else if (line.startsWith('-')) removed.push(line.slice(1));
  }
  for (const file of files) if (file !== OZOW && file !== PAYFAST) errors.push(`unexpected file in lib/payments diff: ${file}`);
  const isComment = (text) => /^\s*(\/\/|\/\*|\*)/.test(text) || text.trim() === '';
  for (const text of removed) if (!ALLOWED_REMOVED.includes(text)) errors.push(`removed line not allowed: ${text}`);
  for (const text of added) if (!REQUIRED_ADDED.includes(text) && !isComment(text)) errors.push(`added line not allowed: ${text}`);
  for (const text of ALLOWED_REMOVED) if (removed.filter((r) => r === text).length !== 1) errors.push(`expected exactly one removal of: ${text}`);
  for (const text of REQUIRED_ADDED) if (added.filter((a) => a === text).length !== 1) errors.push(`expected exactly one addition of: ${text}`);
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('adapter-guard.mjs')) {
  const [mode, arg] = process.argv.slice(2);
  let errors;
  if (mode === 'coupling') {
    const root = path.resolve(arg ?? '.');
    errors = checkCoupling((file) => readFileSync(path.join(root, file), 'utf8'));
  } else if (mode === 'diff') {
    const text = arg ? readFileSync(arg, 'utf8') : spawnSync('git', ['diff', '-U0', 'origin/main', '--', 'lib/payments'], { encoding: 'utf8' }).stdout;
    errors = checkDiff(text);
  } else {
    console.error('usage: adapter-guard.mjs coupling [root] | diff [diffFile]');
    process.exit(2);
  }
  for (const error of errors) console.error(error);
  process.exit(errors.length ? 1 : 0);
}

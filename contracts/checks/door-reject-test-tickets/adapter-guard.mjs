// F4 adapter guard (SEC-06). Static checks that tie the issuance stamp to what the payment adapters really do.
//   node adapter-guard.mjs coupling [root]      sandbox-mode.ts, the stamp, Ozow IsTest and PayFast initiate agree
//   node adapter-guard.mjs client-safe [root]   lib/ticket-issuance-mode.ts reaches lib/payments only through sandbox-mode
//   node adapter-guard.mjs checkout [root]     the checkout route hands the toggle it already read to the builders; no second read
//   node adapter-guard.mjs diff [diffFile]      the only lib/payments change is the leaf module, the flag reads and PayFast's fail-closed branch
// Exit 0 pass, 1 fail with reasons on stderr. adapter-mutation.mjs proves each check bites.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const OZOW = 'lib/payments/ozow.ts';
const PAYFAST = 'lib/payments/payfast.ts';
const LEAF = 'lib/payments/sandbox-mode.ts';
const ISSUANCE = 'lib/ticket-issuance-mode.ts';
const LEAF_IMPORT = "'@/lib/payments/sandbox-mode'";
const PAYFAST_FAIL_CLOSED = "if (!PAYFAST_SANDBOX_MODE) return { ok: false, reason: 'not-configured' };";

// Every non-comment line the branch may add or remove under lib/payments, per file. Each must occur exactly once.
const ADDED = {
  [LEAF]: ['export const OZOW_SANDBOX_MODE = true;', 'export const PAYFAST_SANDBOX_MODE = true;'],
  [OZOW]: [`import { OZOW_SANDBOX_MODE } from ${LEAF_IMPORT};`, 'const OZOW_IS_TEST = String(OZOW_SANDBOX_MODE);'],
  [PAYFAST]: [`import { PAYFAST_SANDBOX_MODE } from ${LEAF_IMPORT};`, PAYFAST_FAIL_CLOSED],
};
const REMOVED = { [OZOW]: ["const OZOW_IS_TEST = 'true';"] };

export function checkCoupling(read) {
  const errors = [];
  const issuance = read(ISSUANCE), ozow = read(OZOW), payfast = read(PAYFAST), leaf = read(LEAF);
  const ozowFlag = leaf.match(/^export const OZOW_SANDBOX_MODE = (true|false);$/m);
  const payfastFlag = leaf.match(/^export const PAYFAST_SANDBOX_MODE = (true|false);$/m);
  if (!ozowFlag) errors.push(`${LEAF}: export const OZOW_SANDBOX_MODE must be a literal boolean`);
  if (!payfastFlag) errors.push(`${LEAF}: export const PAYFAST_SANDBOX_MODE must be a literal boolean`);
  if (/^\s*(import|export\s+\*|export\s*\{[^}]*\}\s*from)\b|\brequire\(|\bprocess\./m.test(leaf)) errors.push(`${LEAF}: must import nothing and read no env`);
  if (!/^export const PAYMENT_GATEWAYS_SANDBOX_ONLY = OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;$/m.test(issuance)) errors.push(`${ISSUANCE}: PAYMENT_GATEWAYS_SANDBOX_ONLY must be exactly OZOW_SANDBOX_MODE || PAYFAST_SANDBOX_MODE (no hand-set flag)`);
  if (!new RegExp(`import\\s*\\{[^}]*\\bOZOW_SANDBOX_MODE\\b[^}]*\\}\\s*from\\s*${LEAF_IMPORT}`).test(issuance) || !new RegExp(`import\\s*\\{[^}]*\\bPAYFAST_SANDBOX_MODE\\b[^}]*\\}\\s*from\\s*${LEAF_IMPORT}`).test(issuance)) errors.push(`${ISSUANCE}: must import both flags from ${LEAF_IMPORT}`);
  if (!ozow.includes(ADDED[OZOW][0]) || /^(export )?const OZOW_SANDBOX_MODE\b/m.test(ozow)) errors.push(`${OZOW}: must import OZOW_SANDBOX_MODE from the leaf module and not redefine it`);
  if (!ozow.includes(ADDED[OZOW][1])) errors.push(`${OZOW}: OZOW_IS_TEST must be String(OZOW_SANDBOX_MODE)`);
  if (!/IsTest: OZOW_IS_TEST,/.test(ozow)) errors.push(`${OZOW}: the initiate payload must send IsTest: OZOW_IS_TEST`);
  if (!payfast.includes(ADDED[PAYFAST][0]) || /^(export )?const PAYFAST_SANDBOX_MODE\b/m.test(payfast)) errors.push(`${PAYFAST}: must import PAYFAST_SANDBOX_MODE from the leaf module and not redefine it`);
  // The admin toggle is a third term. Checkout builders receive it, comps (never gateway-paid) pass an explicit false.
  if (!/export function isIssuanceTestMode\(options: \{ ozowSandboxTestMode: boolean \}\): boolean \{\s*return isTicketingTestMode\(\) \|\| PAYMENT_GATEWAYS_SANDBOX_ONLY \|\| options\.ozowSandboxTestMode !== false;\s*\}/.test(issuance)) errors.push(`${ISSUANCE}: isIssuanceTestMode(options) must be isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY || options.ozowSandboxTestMode !== false`);
  const builders = read('lib/checkout-reservation.ts');
  if ((builders.match(/const issuedInTestMode = isIssuanceTestMode\(\{ ozowSandboxTestMode: input\.ozowSandboxTestMode \}\);/g) ?? []).length !== 2 || (builders.match(/ozowSandboxTestMode: boolean;/g) ?? []).length !== 2) errors.push('lib/checkout-reservation.ts: both builders must stamp isIssuanceTestMode({ ozowSandboxTestMode: input.ozowSandboxTestMode }) and both input types must declare ozowSandboxTestMode: boolean');
  if (!/const issuedInTestMode = isIssuanceTestMode\(\{ ozowSandboxTestMode: false \}\);/.test(read('lib/orders.ts'))) errors.push('lib/orders.ts: createOrderWithPosition (comps) must stamp isIssuanceTestMode({ ozowSandboxTestMode: false })');
  // Fail closed: with the flag false PayFast must refuse before it builds any sandbox form.
  const initiate = payfast.indexOf('async initiate(');
  const guard = payfast.indexOf(PAYFAST_FAIL_CLOSED);
  const sandboxForm = payfast.indexOf('processUrl: PAYFAST_SANDBOX_PROCESS_URL');
  if (guard < 0 || initiate < 0 || guard < initiate || (sandboxForm >= 0 && guard > sandboxForm)) errors.push(`${PAYFAST}: initiate must start with the fail-closed PAYFAST_SANDBOX_MODE branch before any sandbox form`);
  // A flag that says live while Ozow still names sandbox credentials is a lie.
  if (ozowFlag?.[1] === 'false' && /OZOW_SANDBOX_(?!MODE\b)[A-Z_]+/.test(ozow)) errors.push(`${OZOW}: OZOW_SANDBOX_MODE is false but the adapter still uses OZOW_SANDBOX_* credentials`);
  return errors;
}

export function checkClientSafe(read) {
  const errors = [];
  const source = read(ISSUANCE);
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|require\(\s*)'([^']+)'/g)) {
    const spec = match[1];
    if (/(^|\/)payments(\/|$)/.test(spec) && spec !== '@/lib/payments/sandbox-mode') errors.push(`${ISSUANCE}: imports ${spec}; only @/lib/payments/sandbox-mode is allowed`);
    if (/^node:/.test(spec) || /(^|\/)payfast$|(^|\/)ozow$/.test(spec)) errors.push(`${ISSUANCE}: imports ${spec}, which can reach an adapter or a Node built-in`);
  }
  return errors;
}

const CHECKOUT = 'app/api/tickets/checkout/route.ts';

// The admin toggle (adminSettings/ozowSandboxTestMode) is read once by the checkout route (R0.01 override). The stamp
// must reuse that value: the builder call passes `ozowSandboxTestMode: <identifier>` (never a literal), and the number
// of isOzowSandboxTestModeEnabled() calls in the route equals baselineReads (the count on main), so no new Firestore read.
// Slice of `text` from the opening brace at `open` to its matching close brace (strings and comments are not special-cased;
// the call blocks inspected here contain neither braces nor quotes in values).
function braceBlock(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && (depth -= 1) === 0) return text.slice(open, i + 1);
  }
  return '';
}

export function checkCheckout(read, baselineReads) {
  const errors = [];
  const route = read(CHECKOUT);
  const reads = (route.match(/isOzowSandboxTestModeEnabled\(\)/g) ?? []).length;
  if (reads !== baselineReads) errors.push(`${CHECKOUT}: isOzowSandboxTestModeEnabled() is called ${reads} time(s), main has ${baselineReads}; the stamp must reuse the existing read`);
  // The single read: its identifier is the only value allowed to reach the override or the stamp.
  const decls = [...route.matchAll(/^\s*const ([A-Za-z_$][\w$]*) = await isOzowSandboxTestModeEnabled\(\);$/gm)];
  if (decls.length !== 1) { errors.push(`${CHECKOUT}: expected exactly one "const <id> = await isOzowSandboxTestModeEnabled();"`); return errors; }
  const id = decls[0][1];
  // ReservationInput handed to reserveTicket: the override argument and the stamp field are that same identifier.
  const reserveCall = route.indexOf('await reserveTicket({');
  const reserveBlock = reserveCall < 0 ? '' : braceBlock(route, route.indexOf('{', reserveCall));
  if (!reserveBlock) errors.push(`${CHECKOUT}: reserveTicket({...}) call not found`);
  else {
    if (!new RegExp(`\\bexpectedGatewayAmount:\\s*resolveExpectedGatewayAmount\\(\\s*[A-Za-z_$][\\w$]*\\s*,\\s*${id.replace(/\$/g, '\\$')}\\s*\\),`).test(reserveBlock)) errors.push(`${CHECKOUT}: the resolveExpectedGatewayAmount(...) override argument must be ${id}, the value of the single toggle read`);
    if (!new RegExp(`\\bozowSandboxTestMode:\\s*${id.replace(/\$/g, '\\$')},`).test(reserveBlock) || (reserveBlock.match(/\bozowSandboxTestMode:/g) ?? []).length !== 1) errors.push(`${CHECKOUT}: reserveTicket's ozowSandboxTestMode must be ${id} (once), the same identifier that feeds the override`);
  }
  // reserveTicket hands its input field to the builder unchanged.
  const start = route.indexOf('buildMultiReservationDocs({');
  const builderBlock = start < 0 ? '' : braceBlock(route, route.indexOf('{', start));
  if (!/\bozowSandboxTestMode:\s*input\.ozowSandboxTestMode,/.test(builderBlock) || (builderBlock.match(/\bozowSandboxTestMode:/g) ?? []).length !== 1) errors.push(`${CHECKOUT}: buildMultiReservationDocs({...}) must pass ozowSandboxTestMode: input.ozowSandboxTestMode exactly once`);
  return errors;
}

export function checkDiff(diffText) {
  const errors = [];
  const added = new Map(), removed = new Map();
  let file = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('--- ')) continue;
    if (line.startsWith('+++ ')) {
      file = line.slice(4).replace(/^[ab]\//, '');
      if (![OZOW, PAYFAST, LEAF].includes(file)) errors.push(`unexpected file in lib/payments diff: ${file}`);
    } else if (line.startsWith('+')) added.set(file, [...(added.get(file) ?? []), line.slice(1).trim()]);
    else if (line.startsWith('-')) removed.set(file, [...(removed.get(file) ?? []), line.slice(1).trim()]);
  }
  const isComment = (text) => /^\s*(\/\/|\/\*|\*)/.test(text) || text.trim() === '';
  for (const [name, lines] of added) for (const text of lines) if (!(ADDED[name] ?? []).includes(text) && !isComment(text)) errors.push(`${name}: added line not allowed: ${text}`);
  for (const [name, lines] of removed) for (const text of lines) if (!(REMOVED[name] ?? []).includes(text)) errors.push(`${name}: removed line not allowed: ${text}`);
  for (const [name, lines] of Object.entries(ADDED)) for (const text of lines) if ((added.get(name) ?? []).filter((a) => a === text).length !== 1) errors.push(`${name}: expected exactly one addition of: ${text}`);
  for (const [name, lines] of Object.entries(REMOVED)) for (const text of lines) if ((removed.get(name) ?? []).filter((r) => r === text).length !== 1) errors.push(`${name}: expected exactly one removal of: ${text}`);
  return errors;
}

if (process.argv[1]?.endsWith('adapter-guard.mjs')) {
  const [mode, arg] = process.argv.slice(2);
  const reader = () => { const root = path.resolve(arg ?? '.'); return (file) => readFileSync(path.join(root, file), 'utf8'); };
  let errors;
  if (mode === 'coupling') errors = checkCoupling(reader());
  else if (mode === 'checkout') {
    const baseline = spawnSync('git', ['show', `origin/main:${CHECKOUT}`], { encoding: 'utf8' }).stdout;
    errors = checkCheckout(reader(), (baseline.match(/isOzowSandboxTestModeEnabled\(\)/g) ?? []).length);
  } else if (mode === 'client-safe') errors = checkClientSafe(reader());
  else if (mode === 'diff') {
    const text = arg ? readFileSync(arg, 'utf8') : spawnSync('git', ['diff', '-U0', '--no-renames', 'origin/main', '--', 'lib/payments'], { encoding: 'utf8' }).stdout;
    errors = checkDiff(text);
  } else { console.error('usage: adapter-guard.mjs coupling|client-safe|checkout [root] | diff [diffFile]'); process.exit(2); }
  for (const error of errors) console.error(error);
  process.exit(errors.length ? 1 : 0);
}

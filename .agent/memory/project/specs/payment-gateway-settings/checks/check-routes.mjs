// payment-gateway-settings F1: source-position checks on the two admin settings API routes and the
// payments page gate. Run as: node .../checks/check-routes.mjs <gate|audit|mode>
import { readFileSync, existsSync } from 'node:fs';

const ROUTES = [
  'app/api/admin/settings/active-payment-gateway/route.ts',
  'app/api/admin/settings/ozow-sandbox-test-mode/route.ts',
];
let failed = false;
const fail = (m) => { console.error(`FAIL: ${m}`); failed = true; };
const which = process.argv[2];

function src(p) {
  if (!existsSync(p)) { fail(`${p} missing`); return ''; }
  return readFileSync(p, 'utf8');
}
// Strip comments so doc comments naming a symbol cannot satisfy or break position checks.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

if (which === 'gate') {
  for (const p of ROUTES) {
    const s = code(src(p));
    for (const verb of ['GET', 'PUT']) {
      const m = s.match(new RegExp(`export async function ${verb}\\b[\\s\\S]*?\\n}\\n`));
      if (!m) { fail(`${p}: no ${verb} handler`); continue; }
      const body = m[0];
      const gateIdx = body.indexOf('checkGate(');
      const touchIdx = body.search(/resolveActiveGateway\(|isOzowSandboxTestModeEnabled\(|writeAuditedSettingChange\(|getFirestore\(|request\.json\(/);
      if (gateIdx === -1) fail(`${p}: ${verb} never calls checkGate()`);
      else if (touchIdx !== -1 && touchIdx < gateIdx) fail(`${p}: ${verb} reads/writes before checkGate()`);
    }
    if (!/getAdminSession\(\)/.test(s)) fail(`${p}: no getAdminSession()`);
    if (!/hasCapability\([^)]*'manage-payment-settings'/s.test(s)) fail(`${p}: no manage-payment-settings capability check`);
  }
  const layout = code(src('app/admin/(shell)/payments/layout.tsx'));
  if (!/getAdminSession\(\)/.test(layout)) fail('payments/layout.tsx: no getAdminSession()');
  if (!/hasCapability\(/.test(layout) || !/'manage-payment-settings'/.test(layout)) fail('payments/layout.tsx: no manage-payment-settings gate');
  if (!/redirect\('\/admin\/login'\)/.test(layout)) fail('payments/layout.tsx: unauthenticated visitor not sent to /admin/login');
  if (!/redirect\('\/admin'\)/.test(layout)) fail('payments/layout.tsx: non-owner not redirected to /admin');
}

if (which === 'audit') {
  for (const p of ROUTES) {
    const s = code(src(p));
    if (!/writeAuditedSettingChange\(/.test(s)) fail(`${p}: PUT does not use writeAuditedSettingChange`);
    if (/\.doc\([^)]*\)\s*\.set\(/.test(s)) fail(`${p}: still writes the setting directly with .doc().set() (unaudited)`);
    if (!/session\.decodedToken\.uid/.test(s)) fail(`${p}: actor uid not taken from the verified session`);
  }
}

if (which === 'mode') {
  const g = code(src(ROUTES[0]));
  if (!/parsePaymentMode\(/.test(g)) fail('gateway route does not validate a mode field with parsePaymentMode');
  if (!/live-not-available/.test(g) && !/reason/.test(g)) fail('gateway route does not surface the rejection reason');
  if (!/status:\s*400/.test(g)) fail('gateway route has no 400 path');
  for (const p of ROUTES) {
    if (/['"]live['"]/.test(code(src(p)))) fail(`${p}: contains a literal 'live' mode (live must only appear in lib/payment-mode.ts and UI)`);
  }
}

if (failed) process.exit(1);
console.log(`PASS[${which}]`);

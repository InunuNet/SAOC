// Static checks on the login files. Class-token rule compares added lines against origin/main.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const f = (p) => readFileSync(p, 'utf8');
const page = f('app/admin/login/page.tsx');
const fields = f('app/admin/login/LoginFormFields.tsx');
const mod = f('lib/admin-login-errors.ts');
const copy = JSON.parse(f('.agent/memory/project/specs/admin-login-errors/goldens/copy.json'));
const fails = [];
const check = (n, ok) => { if (!ok) fails.push(n); };

check('page: no err.message / .message access', !/\.message\b/.test(page) && !/\.message\b/.test(fields));
check('page: catch uses passwordSignInErrorMessage', /setError\(\s*passwordSignInErrorMessage\(err\)\s*\)/.test(page));
check('page: setError is never fed a bare variable from an Error', !/setError\(\s*(message|err)\b/.test(page));
check('page: imports sendPasswordResetEmail and requestPasswordReset', /sendPasswordResetEmail/.test(page) && /requestPasswordReset/.test(page));
check('page: still has OAuthProvider literals and the session call (F5 A-STRUCT-01)', /new OAuthProvider\('microsoft\.com'\)/.test(page) && /new OAuthProvider\('apple\.com'\)/.test(page) && /\/api\/admin\/session/.test(page));
check('fields: Forgot control with testid and exact label', /data-testid="admin-forgot-password"/.test(fields) && />\s*Forgot password\?\s*</.test(fields));
check('fields: notice is role=status', /role="status"/.test(fields));
check('fields: sign-in error and email prompt use the shared TicketFieldAlert (no hand-rolled role=alert)', /import \{[^}]*TicketFieldAlert[^}]*\} from '@\/components\/tickets\/TicketFormField'/.test(fields) && !/role="alert"/.test(fields));
check('fields: Forgot control uses inline-link and stays type=button', /inline-link/.test(fields) && /type="button"[\s\S]{0,120}admin-forgot-password|admin-forgot-password[\s\S]{0,120}type="button"/.test(fields));
check('fields: Email field is aria-invalid driven and describes its alert', /aria-invalid/.test(fields) && /aria-describedby/.test(fields));
check('no arbitrary hex colours on added lines', !/\+.*(#[0-9a-fA-F]{3,8}\b|rgb\()/.test(execFileSync('git', ['diff', '-U0', 'origin/main', '--', 'app/admin/login'], { encoding: 'utf8' })));
check('module: does not import firebase', !/from ['"]firebase/.test(mod));
check('module: no "Firebase:" literal', !/Firebase:/.test(mod) && !/Firebase:/.test(page));
check('module: exports', ['passwordSignInErrorMessage', 'requestPasswordReset', 'firebaseErrorCode', 'GENERIC_SIGN_IN_ERROR', 'NETWORK_ERROR_MESSAGE'].every((n) => new RegExp(`export (async )?(function|const) ${n}\\b`).test(mod)));
for (const k of ['invalidCredential', 'resetResponse', 'tooManyRequests', 'resetEmptyPrompt', 'network']) {
  const n = [page, fields, mod].join('\n').split(JSON.stringify(copy[k]).slice(1, -1).replace(/'/g, "'")).length - 1;
  check(`copy.${k} appears exactly once in source (found ${n})`, n === 1 || (n === 2 && /'/.test(copy[k])));
}
check('network/generic copy no longer duplicated in page', !/const GENERIC_SIGN_IN_ERROR =/.test(page));

// No new class tokens: every token on an added className/Class line already exists in the origin/main login dir.
const baseFiles = ['app/admin/login/page.tsx', 'app/admin/login/LoginFormFields.tsx', 'app/admin/login/FederatedSignInButtons.tsx', 'app/admin/login/GoogleSignInButton.tsx', 'app/admin/login/MicrosoftSignInButton.tsx', 'app/admin/login/AppleSignInButton.tsx'];
const tokens = (s) => [...s.matchAll(/(["'`])((?:(?!\1).)*)\1/g)].flatMap((x) => x[2].split(/\s+/)).filter(Boolean);
const existing = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', 'app', 'components'], { encoding: 'utf8' }).split('\n').filter((p) => /\.tsx$/.test(p));
const rawTokens = (src) => src.split(/[\s"'`<>={},;]+/).filter(Boolean); // robust to apostrophes in JSX text, unlike the quote-pair scan
const baseline = new Set(existing.flatMap((p) => rawTokens(execFileSync('git', ['show', `origin/main:${p}`], { encoding: 'utf8', maxBuffer: 1 << 26 }))));
baseline.add('inline-link'); // defined in app/globals.css, used site-wide
baseline.add('justify-end'); // plain layout utility, absent on main; Forgot control is right-aligned per NOS Design Fix 1 (no colour, size or font token)
const added = execFileSync('git', ['diff', '-U0', 'origin/main', '--', ...baseFiles], { encoding: 'utf8' }).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && /className|Class\s*=|'[^']*(?:text|bg|border|px|py|font|min-h|w-|rounded|hover|focus)[^']*'/.test(l));
const novel = added.flatMap((l) => tokens(l)).filter((t) => /^[a-z!\[-][\w:\[\]\/.\-()#%]*$/.test(t) && /[-:\[]/.test(t) && !baseline.has(t));
check(`no class token never used on origin/main (${[...new Set(novel)].join(' ')})`, novel.length === 0);

if (fails.length) { console.error(`FAILED:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('admin-login-errors static checks pass');

// nos-critique-r6 F3 — static source check for R82 (vendors/apply form; lead saoc-2b 2026-10-17).
//   S1  nos-theme.css defines `.nos-form-label` ONCE: Karla, 14px, weight 500, color var(--ink), letter-spacing 0, no uppercase;
//       the heading-margin rules (`:is(h` selectors) of BASE are all still present.
//   S2  VendorFormField.tsx and VendorCheckboxGroupField.tsx: no "(required)" anywhere, nos-form-label used when showRequirement is set,
//       the old mono 11px class kept for the register form; VendorFormField keeps `required` and sets aria-required on required inputs.
//   S3  VendorApplyForm.tsx: REQUIRED_SENTENCE untouched; tradingName autoComplete=organization; businessName organization,
//       contactPersonName name, contactEmail email, contactCellPhone tel kept; stands inputMode numeric kept; fetch body
//       keys and order unchanged from BASE.
//   S4  docs cite R82 and the class name.
// Run as: node check-static-f3.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, NOS_THEME, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f3.mjs';
const failures = [];
const fail = (m) => failures.push(m);
const V = 'components/vendors';

// ---- S1 ----
{
  const css = stripComments(readRepoFile(NOS_THEME) ?? '');
  const base = stripComments(readBaseFile(NOS_THEME) ?? '');
  const blocks = [...css.matchAll(/([^{}]*\.nos-form-label[^{}]*)\{([^}]*)\}/g)];
  if (blocks.length !== 1) fail(`nos-theme.css must define .nos-form-label exactly once, found ${blocks.length} rule(s) (S1)`);
  else {
    const body = blocks[0][2];
    if (!/font-size:\s*14px;/.test(body)) fail('.nos-form-label must be font-size: 14px (S1)');
    if (!/font-weight:\s*500;/.test(body)) fail('.nos-form-label must be font-weight: 500 (S1)');
    if (!/color:\s*var\(--ink\);/.test(body)) fail('.nos-form-label must be color: var(--ink), full ink (S1)');
    if (!/letter-spacing:\s*0(?:px)?;/.test(body)) fail('.nos-form-label must be letter-spacing: 0 (S1)');
    if (!/font-family:[^;]*(?:karla|var\(--font-nos-karla|var\(--sans|var\(--font-sans)/i.test(body)) fail('.nos-form-label must set the Karla family (S1)');
    if (/text-transform:\s*uppercase|opacity|rgba?\(|--muted/.test(body)) fail('.nos-form-label must not be uppercase, translucent or muted (S1)');
  }
  const headingRules = base.split('\n').filter((l) => /:is\(h[1-6]/.test(l));
  for (const l of headingRules) if (!css.includes(l)) fail(`nos-theme.css heading rule changed or removed: ${l.trim()} (S1)`);
}
// ---- S2 ----
for (const f of ['VendorFormField.tsx', 'VendorCheckboxGroupField.tsx']) {
  const raw = readRepoFile(`${V}/${f}`) ?? '';
  const code = stripComments(raw);
  if (/\(required\)/.test(code)) fail(`${f}: "(required)" suffix must be gone (S2)`);
  if (!/nos-form-label/.test(code)) fail(`${f}: must apply nos-form-label when showRequirement is set (S2)`);
  if (!/font-mono text-\[11px\]/.test(code)) fail(`${f}: the register-form label class (font-mono text-[11px]) must stay for showRequirement=false (S2)`);
}
if (!/aria-required=\{required\s*(?:\?\s*true\s*:\s*undefined|\|\|\s*undefined|\?\s*'true'\s*:\s*undefined)\}|aria-required=\{required\}/.test(stripComments(readRepoFile(`${V}/VendorFormField.tsx`) ?? ''))) fail('VendorFormField.tsx must set aria-required for required inputs (Codi: dropping the visible suffix loses no semantics) (S2)');
if (!/required=\{required\}/.test(stripComments(readRepoFile(`${V}/VendorFormField.tsx`) ?? ''))) fail('VendorFormField.tsx must keep the required attribute (S2)');
// ---- S3 ----
{
  const code = stripComments(readRepoFile(`${V}/VendorApplyForm.tsx`) ?? '');
  const base = stripComments(readBaseFile(`${V}/VendorApplyForm.tsx`) ?? '');
  const sentence = "const REQUIRED_SENTENCE = 'All fields are required unless marked optional.';";
  if (!code.includes(sentence)) fail('VendorApplyForm.tsx: REQUIRED_SENTENCE must stay exactly as is (S3)');
  const block = (key) => { const m = code.match(new RegExp(`fieldKey="${key}"[\\s\\S]*?/>`)); return m ? m[0] : ''; };
  for (const [key, token] of [['businessName', 'organization'], ['tradingName', 'organization'], ['contactPersonName', 'name'], ['contactEmail', 'email'], ['contactCellPhone', 'tel']]) {
    if (!new RegExp(`autoComplete="${token}"`).test(block(key))) fail(`VendorApplyForm.tsx: ${key} needs autoComplete="${token}" (S3)`);
  }
  if (!/label="Trading name \(if different, optional\)"/.test(code)) fail('VendorApplyForm.tsx: the tradingName label must be exactly "Trading name (if different, optional)" (Codi) (S3)');
  if (/\) \(/.test(copyStrings(code).join('\n') + (code.match(/label="[^"]*"/g) ?? []).join('\n'))) fail('VendorApplyForm.tsx: no label may contain ") (" (doubled parentheses) (S3)');
  if (!/inputMode="numeric"/.test(block('indicativeBoothCount'))) fail('VendorApplyForm.tsx: the stands field needs inputMode="numeric" (S3)');
  const body = (s) => (s.match(/body:\s*JSON\.stringify\(\{[\s\S]*?\}\),/) ?? [''])[0].replace(/\s+/g, ' ');
  if (body(code) === '' || body(code) !== body(base)) fail('VendorApplyForm.tsx: the POST body must be unchanged from BASE (S3)');
}
// ---- S4b supersession: the two launch-weekend F7 checks that pinned "(required)" are amended in this branch ----
{
  const h = readRepoFile('contracts/checks/launch-weekend/f7/check-h-vendor-static.mjs') ?? '';
  if (/!\/\\\(required\\\)\/\.test\(form \+ field\)/.test(h)) fail('contracts/checks/launch-weekend/f7/check-h-vendor-static.mjs:36 must no longer require "(required)" (R82 supersedes launch-weekend F7) (S4)');
  const i = readRepoFile('contracts/checks/launch-weekend/f7/check-i-vendor-runtime.mjs') ?? '';
  if (/'\(required\)'/.test(i)) fail('contracts/checks/launch-weekend/f7/check-i-vendor-runtime.mjs:26 must no longer expect "(required)" labels (S4)');
}
// ---- S4 ----
const doc = readRepoFile(DOC);
if (doc === null || !/R82/.test(doc) || !/nos-form-label/.test(doc)) fail(`${DOC} must cite R82 and the nos-form-label class (S4)`);
if (!/supersed/i.test(doc ?? '') || !/launch-weekend F7/.test(doc ?? '')) fail(`${DOC} must record the supersession of launch-weekend F7's "(required)" checks, citing R82 (S4)`);

finish(NAME, failures, 'R82: one .nos-form-label rule (Karla 14px/500 ink), no "(required)", required + aria-required kept, exact tradingName label, launch-weekend F7 checks amended, autocomplete tokens and stands inputmode in place, POST body unchanged, docs cite R82.');

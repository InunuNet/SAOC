// F8 static (media kit: "Mark only" and "National Show 2027" behind a picker). The SAOC /media-kit is committee-gated
// (requireMediaKitAccess), so the page body is extracted to app/(marketing)/media-kit/MediaKitPageBody.tsx (kept in
// that directory: contracts/checks/media-kit-complete/check_manifest_page.py and check_layout_static.py scan it) and
// rendered for the rendered check by an env-gated fixture route, following app/events-fixtures and app/admin-fixtures.
//   MK-1 components/media-kit/OptionPicker.tsx: a client radio group in the DuotonePicker's markup (44px chips, same
//        tokens), text-only (no swatch, so no invented colour), hash-synced as #<prefix>-<id>, every panel rendered
//        and all but the selected one hidden; DuotonePicker.tsx itself is not touched (the scope guard enforces it)
//   MK-2 the body uses two <OptionPicker>s, in #mark-only and #national-show, and keeps the section zips, the
//        "Vector masters" note and the emblem card
//   MK-3 page.tsx keeps requireMediaKitAccess and renders <MediaKitPageBody />; the fixture route is force-dynamic,
//        404s unless MEDIA_KIT_FIXTURES === '1', and that flag is in no deploy or example env file
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f8-kit-static.mjs   (POLISH_ROOT optional)
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, read, repoRoot } from './_lib.mjs';

const failures = [];
const tryRead = (rel) => { try { return read(rel); } catch (e) { failures.push(e.message); return ''; } };

const picker = tryRead('components/media-kit/OptionPicker.tsx');
if (!/^'use client';/m.test(picker)) failures.push("OptionPicker is not a client component ('use client')");
if (!/type="radio"/.test(picker) || !/role="radiogroup"/.test(picker)) failures.push('OptionPicker is not a radio group (type="radio" inside role="radiogroup")');
if (!/min-h-\[44px\]/.test(picker)) failures.push('OptionPicker chips are not min-h-[44px]');
if (!/hashchange/.test(picker) || !/replaceState/.test(picker)) failures.push('OptionPicker does not sync the selection to the URL hash (hashchange + history.replaceState)');
if (!/hidden/.test(picker) || !/data-option=/.test(picker)) failures.push('OptionPicker does not render every panel with data-option and hide the unselected ones');
if (!/peer-checked:font-semibold|peer-checked:font-bold/.test(picker) || !/peer-checked:ring-/.test(picker)) failures.push('the selected chip must be visible without colour alone: peer-checked:font-semibold (or bold) plus a peer-checked:ring-* (NOS Design ruling)');
if (/tabIndex=\{[^}]*[1-9]/.test(picker)) failures.push('OptionPicker sets a positive tabIndex (focus order must follow the DOM: radios, preview, downloads)');
if (/backgroundColor|#[0-9a-fA-F]{6}\b|\bhex\b/.test(picker)) failures.push('OptionPicker carries a colour or hex (swatches are not supplied for these options; text only)');
if (/<legend\b(?![^>]*sr-only)/.test(picker)) failures.push('OptionPicker legend must be visually hidden (sr-only): the visible words are the section heading');

// Round 2 (NOS Design): Full colour and Greyscale merge into one picker headed "Full colour · Greyscale".
const lockup = tryRead('components/media-kit/LockupPicker.tsx');
if (!/^'use client';/m.test(lockup)) failures.push("LockupPicker is not a client component ('use client')");
if ((lockup.match(/role="radiogroup"/g) ?? []).length < 2 || !/type="radio"/.test(lockup)) failures.push('LockupPicker needs two radio groups (family toggle and variants)');
if (!/min-h-\[44px\]/.test(lockup)) failures.push('LockupPicker chips are not min-h-[44px]');
if (!/hashchange/.test(lockup) || !/replaceState/.test(lockup)) failures.push('LockupPicker does not sync to the URL hash');
if (!/peer-checked:font-semibold|peer-checked:font-bold/.test(lockup) || !/peer-checked:ring-/.test(lockup)) failures.push('LockupPicker selected state must be weight plus ring, not colour alone');
if (/tabIndex=\{[^}]*[1-9]/.test(lockup)) failures.push('LockupPicker sets a positive tabIndex');
const body = tryRead('app/(marketing)/media-kit/MediaKitPageBody.tsx');
if (!/<LockupPicker\b/.test(body)) failures.push('MediaKitPageBody does not render <LockupPicker>');
if (!/<KitSection\b[^>]*id="lockups"[^>]*heading="Full colour · Greyscale"/.test(body)) failures.push('MediaKitPageBody has no <KitSection id="lockups" heading="Full colour · Greyscale"> (the two existing headings, NOS Design)');
if (/heading="Lockups"|>\s*Lockups\s*</.test(body + lockup)) failures.push('the visible word "Lockups" must not appear (heading or text): it is not an existing string');
if (/<KitSection\b[^>]*id="(full-colour|greyscale)"/.test(body)) failures.push('the separate Full colour and Greyscale sections are still there');
for (const anchor of ['full-colour', 'greyscale']) if (!new RegExp(`id="${anchor}"`).test(body)) failures.push(`the "On this page" anchor id="${anchor}" must stay (inside the Lockups section) so the existing jump links deep-link to the picker`);
for (const key of ["kit.sectionZips['full-colour']", 'kit.sectionZips.greyscale']) if (!body.includes(key)) failures.push(`MediaKitPageBody dropped ${key} (both family zips stay in the Lockups section)`);
const lockSection = body.match(/<KitSection\b[^>]*id="lockups"[\s\S]*?<\/KitSection>/)?.[0] ?? '';
if ((lockSection.match(/<ZipLink\b/g) ?? []).length > 1 || (lockSection.match(/\bzip=\{/g) ?? []).length > 1) failures.push('the merged section renders more than one zip link; round 4: ONE link that follows the family toggle (WCAG 2.4.4)');

for (const [href, label] of [['#full-colour', 'Full colour'], ['#greyscale', 'Greyscale']]) if (!new RegExp(`href: '${href}', label: '${label}'`).test(body)) failures.push(`JUMP_ITEMS lost { href: '${href}', label: '${label}' }`);
const pickers = body.match(/<OptionPicker\b/g) ?? [];
if (pickers.length !== 2) failures.push(`MediaKitPageBody renders ${pickers.length} <OptionPicker>, want 2`);
for (const id of ['mark-only', 'national-show', 'duotone']) if (!new RegExp(`id="${id}"`).test(body)) failures.push(`MediaKitPageBody lost section id="${id}"`);
if (!/<DuotonePicker\b/.test(body)) failures.push('the Duotone section must keep <DuotonePicker> unchanged');
for (const z of ["kit.sectionZips['mark-only']", "kit.sectionZips['national-show']"]) if (!body.includes(z)) failures.push(`MediaKitPageBody dropped ${z}`);
if (!/Vector masters/.test(body)) failures.push('the "Vector masters" note is gone');
if (!/kit\.nationalShowEmblem/.test(body)) failures.push('the National Show emblem card is gone');
if (!/media-kit-manifest/.test(body) && !/media-kit-manifest/.test(tryRead('app/(marketing)/media-kit/page.tsx'))) failures.push('the manifest is not imported in the media-kit directory');

const page = tryRead('app/(marketing)/media-kit/page.tsx');
if (!/await requireMediaKitAccess\('\/media-kit'\)/.test(page)) failures.push('page.tsx lost `await requireMediaKitAccess(\'/media-kit\')`');
if (!/<MediaKitPageBody\b/.test(page)) failures.push('page.tsx does not render <MediaKitPageBody />');
if (/requireMediaKitAccess/.test(body)) failures.push('MediaKitPageBody must not call the gate (the page does, before it)');

const fxPath = 'app/media-kit-fixtures/page.tsx';
if (!existsSync(resolve(repoRoot, fxPath))) failures.push(`${fxPath} does not exist`);
else {
  const fx = tryRead(fxPath);
  if (!/export const dynamic = 'force-dynamic'/.test(fx)) failures.push('fixture route is not force-dynamic');
  if (!/process\.env\.MEDIA_KIT_FIXTURES !== '1'/.test(fx) || !/notFound\(\)/.test(fx)) failures.push("fixture route does not notFound() unless MEDIA_KIT_FIXTURES === '1'");
  if (!/<MediaKitPageBody\b/.test(fx)) failures.push('fixture route does not render <MediaKitPageBody />');
  if (/requireMediaKitAccess|getAdminSession/.test(fx)) failures.push('fixture route must not touch the gate or the admin session (no auth bypass is added anywhere)');
}
for (const rel of ['apphosting.yaml', '.env.local.example', 'firebase.json', 'next.config.ts']) {
  const p = resolve(repoRoot, rel);
  if (existsSync(p) && readFileSync(p, 'utf8').includes('MEDIA_KIT_FIXTURES')) failures.push(`${rel} must not mention MEDIA_KIT_FIXTURES`);
}
finish('f8-kit-static', failures);

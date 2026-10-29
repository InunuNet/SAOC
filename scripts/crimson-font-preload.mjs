// Maps the Crimson Pro normal font preload to the file next/font emits for it (F1e).
//
// next/font names the file with a content hash (`CrimsonPro_latin_normal-s.<hash>.woff2`), so the
// preload <link> in components/site-chrome/SaocFontPreload.tsx needs that exact name. The name is
// committed in components/site-chrome/crimson-preload.json and imported at build time, so the
// server does no filesystem work. This script keeps the mapping honest:
//   node scripts/crimson-font-preload.mjs --write    regenerate it from .next/static/media
//   node scripts/crimson-font-preload.mjs --verify   fail unless it names a file the build emitted
// `pnpm build` runs --verify after `next build`, so a stale mapping fails the build instead of
// shipping a preload for a file that does not exist (which would also fetch the font twice).

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const MEDIA_DIR = join(ROOT, '.next', 'static', 'media');
const MAPPING_PATH = join(ROOT, 'components', 'site-chrome', 'crimson-preload.json');
const CRIMSON_NORMAL = /^CrimsonPro_latin_normal-.*\.woff2$/;

function emittedFiles() {
  const files = readdirSync(MEDIA_DIR).filter((name) => CRIMSON_NORMAL.test(name));
  if (files.length !== 1) {
    throw new Error(
      `expected exactly one CrimsonPro_latin_normal woff2 in ${MEDIA_DIR}, found ${files.length}`,
    );
  }
  return files[0];
}

const mode = process.argv[2];
if (mode === '--write') {
  writeFileSync(MAPPING_PATH, `${JSON.stringify({ file: emittedFiles() }, null, 2)}\n`);
  console.log(`crimson-preload: wrote ${MAPPING_PATH}`);
} else if (mode === '--verify') {
  const mapped = JSON.parse(readFileSync(MAPPING_PATH, 'utf8')).file;
  const emitted = emittedFiles();
  if (mapped !== emitted) {
    console.error(
      `crimson-preload: ${MAPPING_PATH} names ${mapped} but the build emitted ${emitted}. ` +
        'Run: node scripts/crimson-font-preload.mjs --write, then commit it.',
    );
    process.exit(1);
  }
  console.log(`crimson-preload: ok (${emitted})`);
} else {
  console.error('usage: crimson-font-preload.mjs --write | --verify');
  process.exit(2);
}

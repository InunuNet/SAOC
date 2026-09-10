// menu-system-layout4 M1/F1 -- PROPERTY 6 (mission section 6): every descriptor string in
// nav-config.ts is a trimmed prefix of its manifest row's own `purpose` field, never free
// text. This is the back door through which invention enters a menu -- it is mechanically
// checkable and must be checked, per this repo's audited "assertion satisfiable without the
// property it claims to prove" defect class.
//
// Source resolution for content/national-show-routes.json, in order (PROPERTY 7 -- render
// SKIPPED, never PASS, if neither resolves):
//   1. the working tree (once the NOS lane merges to main, it will live here directly)
//   2. `git show origin/nos-site:content/national-show-routes.json` (today's location)
// A resolution failure prints "SKIPPED" on its own first line and exits 0 -- the shared
// contract runner and any human reading gate output must not read a SKIP as a pass; grep for
// the literal string "SKIPPED" if wiring this into a stricter gate later.
//
// Run via: node contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs [navModulePath]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_REL = 'content/national-show-routes.json';

function loadManifest() {
  const workTreePath = path.join(REPO_ROOT, MANIFEST_REL);
  if (existsSync(workTreePath)) {
    return { source: `working tree: ${MANIFEST_REL}`, json: JSON.parse(readFileSync(workTreePath, 'utf8')) };
  }
  try {
    const raw = execFileSync('git', ['show', `origin/nos-site:${MANIFEST_REL}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return { source: `origin/nos-site:${MANIFEST_REL}`, json: JSON.parse(raw) };
  } catch (error) {
    return { source: null, json: null, error };
  }
}

function flattenLeaves(nav) {
  // Returns [{ href, descriptor }] for every leaf that carries a descriptor: mega columns'
  // links, and lead.theShow's links. Top-level `link` items and column/lead headings are
  // out of scope -- the mission only requires descriptors on leaves.
  const leaves = [];
  for (const item of nav) {
    if (item.type !== 'mega') continue;
    if (item.lead?.theShow) {
      for (const link of item.lead.theShow.links) {
        leaves.push({ href: link.href, descriptor: link.descriptor });
      }
    }
    for (const column of item.columns) {
      for (const link of column.links) {
        leaves.push({ href: link.href, descriptor: link.descriptor });
      }
    }
  }
  return leaves;
}

async function main() {
  const targetArg = process.argv[2];
  const modulePath = targetArg
    ? path.resolve(process.cwd(), targetArg)
    : path.join(REPO_ROOT, 'components/chrome/nav-config.ts');

  const { source, json: manifest, error } = loadManifest();
  if (!manifest) {
    console.log('SKIPPED');
    console.log(
      `could not resolve ${MANIFEST_REL} from the working tree or origin/nos-site -- ` +
        `descriptor provenance cannot be checked right now. This must render SKIPPED, never PASS. ` +
        `Underlying error: ${error?.message ?? '(unknown)'}`,
    );
    process.exit(0);
  }

  const manifestByHref = new Map(manifest.routes.map((r) => [r.slug, r]));
  // R3 override: the manifest's own slug for the WOSA row is /national-show/wosa, but ruling
  // R3 (mission section 2) overturns that to /national-show/wosa-conference. Map the NAV
  // href we actually use back to the manifest row that carries its purpose text.
  const hrefAliases = new Map([['/national-show/wosa-conference', '/national-show/wosa']]);

  const { NAV } = await import(modulePath);
  const leaves = flattenLeaves(NAV);

  const failures = [];
  for (const { href, descriptor } of leaves) {
    const manifestHref = hrefAliases.get(href) ?? href;
    const route = manifestByHref.get(manifestHref);
    if (!route) {
      failures.push(`${href}: no manifest row found (checked slug '${manifestHref}')`);
      continue;
    }
    if (!descriptor || descriptor.trim().length === 0) {
      failures.push(`${href}: descriptor is empty`);
      continue;
    }
    const trimmedDescriptor = descriptor.trim();
    const trimmedPurpose = route.purpose.trim();
    if (!trimmedPurpose.startsWith(trimmedDescriptor)) {
      failures.push(
        `${href}: descriptor "${trimmedDescriptor}" is not a prefix of manifest purpose ` +
          `"${trimmedPurpose}"`,
      );
    }
  }

  if (failures.length === 0) {
    console.log(`OK -- ${leaves.length} descriptors verified against ${source}.`);
    process.exit(0);
  }

  console.error(`Descriptor provenance failures (source: ${source}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

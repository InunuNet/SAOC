// A4 — F1 fast early-signal check: deliberately simple companion to A2's mechanical
// import-graph walk. Reads contracts/contract-payfast-m1.yaml and, for each of the
// known-as-of-authoring affected IDs, confirms timeout_seconds >= 120. This is the
// "fast, cheap, will go stale if the ID list changes" half — A2/A3 are the self-updating
// mechanical proof; this one exists only so a quick `pnpm exec tsx` catches the common
// case without needing the full import-graph walk. See
// contracts/golden/payfast-m1-lock-cleanup-fix/lock-timeout-invariant.golden.md.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSERTION_ID = 'A4';
const REQUIRED_TIMEOUT_SECONDS = 120;
const KNOWN_AFFECTED_IDS = ['A18', 'A19', 'A20', 'A21', 'A30', 'A31', 'A34'];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'contracts/contract-payfast-m1.yaml');

/** Splits the checks: list into one text block per assertion id (same approach as
 * check-lock-timeout-invariant.mjs, kept independent on purpose — this script is meant
 * to be simple and read standalone). */
function splitIntoBlocks(yamlText) {
  const lines = yamlText.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const idMatch = /^\s*-\s*id:\s*(\S+)/.exec(line);
    if (idMatch) {
      if (current) blocks.push(current);
      current = { id: idMatch[1], text: line };
    } else if (current) {
      current.text += `\n${line}`;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function extractTimeoutSeconds(blockText) {
  const match = /timeout_seconds:\s*(\d+)/.exec(blockText);
  return match ? Number(match[1]) : 60; // contract.py's own default (execution/contract.py)
}

const yamlText = readFileSync(CONTRACT_PATH, 'utf8');
const blocksById = new Map(splitIntoBlocks(yamlText).map((block) => [block.id, block.text]));

const offenders = [];
for (const id of KNOWN_AFFECTED_IDS) {
  const blockText = blocksById.get(id);
  if (blockText === undefined) {
    offenders.push(`${id}: not found in ${path.relative(REPO_ROOT, CONTRACT_PATH)} (ID list is stale — update this script or investigate)`);
    continue;
  }
  const timeoutSeconds = extractTimeoutSeconds(blockText);
  if (timeoutSeconds < REQUIRED_TIMEOUT_SECONDS) {
    offenders.push(`${id}: timeout_seconds ${timeoutSeconds} is below the required ${REQUIRED_TIMEOUT_SECONDS}`);
  }
}

if (offenders.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} — known lock-waiting assertion(s) with an inadequate timeout_seconds:`);
  for (const offender of offenders) console.error(`  - ${offender}`);
  process.exit(1);
}
console.log(`PASS: ${ASSERTION_ID} — all known lock-waiting assertions (${KNOWN_AFFECTED_IDS.join(', ')}) declare timeout_seconds >= ${REQUIRED_TIMEOUT_SECONDS}`);

// Shared helpers for the nos-presenter-cards check scripts (QA inputs, written by @architect).
// Same pattern as contracts/checks/conference-workshop-tickets-f6/_lib.mjs: tsx is registered
// programmatically so these run as plain `node`, and repo modules are imported by path.
//
// NOS_PC_ROOT overrides the repo root, so each check can be run against an exported copy of
// the pre-feature base to prove it fails there (mutation proof). Unset in the gate.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { register } from 'tsx/esm/api';

register();

export const repoRoot = process.env.NOS_PC_ROOT
  ? path.resolve(process.env.NOS_PC_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function repoPath(relPath) {
  return path.join(repoRoot, relPath);
}

/** File text, or null when the file does not exist. */
export function readRepoFile(relPath) {
  const abs = repoPath(relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** Imports a repo module by its path relative to the repo root. */
export async function loadRepoModule(relPath) {
  return import(pathToFileURL(repoPath(relPath)).href);
}

/** Prints FAIL + bullet list and exits 1 if `failures` is non-empty; otherwise prints PASS. */
export function finish(scriptName, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${scriptName}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}

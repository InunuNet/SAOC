import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSignature } from '../lib/payfast';

/**
 * Correctness gate for lib/payfast.ts `generateSignature()`. Reproduces the three real
 * MD5 vectors in contracts/golden/payfast-m1/signature-vectors.json exactly. A mismatch
 * here means checkout signing and/or ITN verification will silently fail against the
 * real PayFast API — treat any failure as blocking.
 *
 * Vectors are loaded from the golden file at runtime (rather than hardcoded here) so
 * this script never embeds a literal PayFast sandbox credential in source.
 *
 * Run with: pnpm exec tsx scripts/verify-payfast-signature.ts
 */

interface SignatureVector {
  ordered_fields: Record<string, string>;
  passphrase: string | null;
  expected_signature: string;
}

const VECTOR_NAMES = [
  'checkout_no_passphrase',
  'checkout_with_passphrase',
  'itn_with_passphrase',
] as const;

function loadVectors(): Record<string, SignatureVector> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const vectorsPath = join(
    scriptDir,
    '..',
    'contracts',
    'golden',
    'payfast-m1',
    'signature-vectors.json'
  );
  const raw = readFileSync(vectorsPath, 'utf8');
  return JSON.parse(raw) as Record<string, SignatureVector>;
}

function main(): void {
  const vectors = loadVectors();
  let failures = 0;

  for (const name of VECTOR_NAMES) {
    const vector = vectors[name];
    if (!vector) {
      failures += 1;
      process.stderr.write(`FAIL ${name}: vector not found in signature-vectors.json\n`);
      continue;
    }

    const actual = generateSignature(vector.ordered_fields, vector.passphrase);
    if (actual === vector.expected_signature) {
      process.stderr.write(`PASS ${name}\n`);
    } else {
      failures += 1;
      process.stderr.write(
        `FAIL ${name}: expected ${vector.expected_signature}, got ${actual}\n`
      );
    }
  }

  if (failures > 0) {
    process.stderr.write(`\n${failures} signature vector(s) failed.\n`);
    process.exit(1);
  }

  process.stderr.write('\nAll signature vectors reproduced exactly.\n');
}

main();

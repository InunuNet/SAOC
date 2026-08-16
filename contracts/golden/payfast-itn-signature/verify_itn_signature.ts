// Golden verification harness for the PayFast ITN signature defect.
// Usage: tsx verify_itn_signature.ts <mode> [moduleSpecifier]
//   mode: valid | tampered | split | outbound-unchanged
//   moduleSpecifier: import path for lib/payfast.ts's exports (default: real project path)
// Exit 0 = correct behaviour observed. Exit 1 = defect present / broken variant detected.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

async function main(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mode = process.argv[2];
  const moduleSpecifier = process.argv[3] ?? '../../../lib/payfast.ts';

  const mod = await import(moduleSpecifier);
  const { buildPayfastParamString, buildPayfastNotifyParamString, generateNotifySignature } = mod;

  function parsePosted(raw: string): { fields: Record<string, string>; signature: string | null } {
    const fields: Record<string, string> = {};
    let signature: string | null = null;
    for (const pair of raw.split('&')) {
      const eq = pair.indexOf('=');
      const key = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' '));
      const value = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
      if (key === 'signature') {
        signature = value;
      } else {
        fields[key] = value;
      }
    }
    return { fields, signature };
  }

  function loadFixture(name: string) {
    const raw = readFileSync(join(__dirname, name), 'utf8').trim();
    return parsePosted(raw);
  }

  if (mode === 'valid') {
    const { fields, signature } = loadFixture('sandbox-itn.raw.txt');
    if (typeof generateNotifySignature !== 'function') {
      console.error('FAIL: generateNotifySignature is not exported');
      process.exit(1);
    }
    const computed = generateNotifySignature(fields, null);
    if (computed === signature) {
      console.log('PASS: valid fixture signature verified:', computed);
      process.exit(0);
    }
    console.error(`FAIL: expected ${signature}, got ${computed}`);
    process.exit(1);
  }

  if (mode === 'tampered') {
    // Self-contained sensitivity check: compute the signature for BOTH the original and
    // tampered fixture with the SAME implementation, and require them to differ. This
    // catches a broken variant that silently drops a field (e.g. amount_gross) from the
    // param string — such a variant can still match the fixture's embedded 'valid'
    // signature by coincidence-of-omission, so comparing only against the fixture's
    // embedded signature is not sufficient; comparing the implementation against itself is.
    const { fields: origFields, signature: embeddedSignature } = loadFixture('sandbox-itn.raw.txt');
    const { fields: tampFields, signature: tampEmbeddedSignature } = loadFixture('sandbox-itn-tampered.raw.txt');
    const origComputed = generateNotifySignature(origFields, null);
    const tampComputed = generateNotifySignature(tampFields, null);
    if (tampComputed === tampEmbeddedSignature) {
      console.error('FAIL: tampered fixture incorrectly ACCEPTED against its own embedded signature');
      process.exit(1);
    }
    if (origComputed === tampComputed) {
      console.error('FAIL: altering amount_gross did not change the computed signature — field is not covered by the signed string');
      process.exit(1);
    }
    console.log('PASS: tampering amount_gross changes the computed signature, and the tampered body fails verification');
    process.exit(0);
  }

  if (mode === 'split') {
    const { fields } = loadFixture('sandbox-itn.raw.txt');
    const outbound = buildPayfastParamString(fields);
    const inbound = buildPayfastNotifyParamString(fields);
    if (outbound !== inbound) {
      console.log('PASS: outbound and inbound param-string builders diverge as required');
      process.exit(0);
    }
    console.error('FAIL: outbound and inbound builders produce identical output — no split exists (BUG PRESENT)');
    process.exit(1);
  }

  if (mode === 'outbound-unchanged') {
    const probe = { a: '  hi  ', b: '', c: 'x' };
    const result = buildPayfastParamString(probe);
    if (result === 'a=hi&c=x') {
      console.log('PASS: outbound builder still trims and skips blanks');
      process.exit(0);
    }
    console.error(`FAIL: outbound builder behaviour changed — got "${result}", expected "a=hi&c=x"`);
    process.exit(1);
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(2);
}

main();

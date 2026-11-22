import { getClientIp } from '../lib/payfast';

/**
 * Correctness gate for lib/payfast.ts `getClientIp()`, which delegates to lib/client-ip.ts
 * `clientIpFromHeaders()`. Observed on the deployed Firebase App Hosting server (2026-11-22):
 * the platform appends THREE entries to X-Forwarded-For (`<client-supplied...>, CLIENT, PROXY,
 * PROXY`) and writes `x-fah-client-ip`, so the real client is the THIRD-TO-LAST hop.
 *
 * This exercises getClientIp() against synthetic headers and asserts it extracts the real
 * client IP specifically, not a string/grep match against source code.
 *
 * Run with: pnpm exec tsx scripts/verify-payfast-itn-ip.ts
 */

interface IpTestCase {
  name: string;
  headers: Record<string, string>;
  expected: string | null;
}

function makeRequest(headers: Record<string, string>): { headers: { get(name: string): string | null } } {
  return {
    headers: {
      get(name: string): string | null {
        const key = Object.keys(headers).find((h) => h.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  };
}

const CASES: IpTestCase[] = [
  {
    name: 'platform_shape_extracts_third_to_last',
    headers: { 'x-forwarded-for': '203.0.113.9, 203.0.113.7, 66.249.1.1, 74.125.1.1' },
    expected: '203.0.113.7',
  },
  {
    name: 'exactly_three_hops_extracts_first',
    headers: { 'x-forwarded-for': '203.0.113.7, 66.249.1.1, 74.125.1.1' },
    expected: '203.0.113.7',
  },
  {
    name: 'many_spoofed_hops_still_extracts_third_to_last',
    headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7, 66.249.1.1, 74.125.1.1' },
    expected: '203.0.113.7',
  },
  {
    name: 'valid_fah_header_wins',
    headers: {
      'x-forwarded-for': '1.1.1.1, 2.2.2.2, 66.249.1.1, 74.125.1.1',
      'x-fah-client-ip': '203.0.113.7',
    },
    expected: '203.0.113.7',
  },
  {
    name: 'two_hops_off_platform_uses_last',
    headers: { 'x-forwarded-for': '203.0.113.7, 130.211.4.9' },
    expected: '130.211.4.9',
  },
  {
    name: 'single_hop_is_used_as_is',
    headers: { 'x-forwarded-for': '203.0.113.7' },
    expected: '203.0.113.7',
  },
  {
    name: 'falls_back_to_x_real_ip_when_no_xff',
    headers: { 'x-real-ip': 'fallbackIp' },
    expected: 'fallbackIp',
  },
  {
    name: 'no_headers_returns_null',
    headers: {},
    expected: null,
  },
];

function main(): void {
  let failures = 0;

  for (const testCase of CASES) {
    const request = makeRequest(testCase.headers);
    const actual = getClientIp(request);
    if (actual === testCase.expected) {
      process.stderr.write(`PASS ${testCase.name}: got ${JSON.stringify(actual)}\n`);
    } else {
      failures += 1;
      process.stderr.write(
        `FAIL ${testCase.name}: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}\n`
      );
    }
  }

  if (failures > 0) {
    process.stderr.write(`\n${failures} getClientIp() case(s) failed.\n`);
    process.exit(1);
  }

  process.stderr.write('\nAll getClientIp() cases correctly extracted the client hop.\n');
}

main();

import { getClientIp } from '../lib/payfast';

/**
 * Correctness gate for lib/payfast.ts `getClientIp()`. Firebase App Hosting sits behind a
 * full external Google Cloud Load Balancer (GCLB) + Cloud CDN in front of Cloud Run — see
 * https://firebase.google.com/docs/app-hosting/about-app-hosting. Per
 * https://cloud.google.com/load-balancing/docs/https, GCLB APPENDS exactly two entries to
 * X-Forwarded-For: the client IP, then the load balancer's own forwarding-rule IP. So the
 * header Cloud Run receives is `<attacker-controlled-prefix>,<real-client-ip>,<lb-ip>` —
 * the real client IP is always the SECOND-TO-LAST hop, never the last (that's the LB) and
 * never the first (that's spoofable by the caller).
 *
 * This exercises getClientIp() against a synthetic three-hop header and asserts it
 * extracts the real client IP specifically — not a string/grep match against source code.
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
    // The canonical GCLB shape: attacker-supplied prefix, then real client IP, then LB IP.
    name: 'three_hop_gclb_shape_extracts_second_to_last',
    headers: { 'x-forwarded-for': 'spoofedIp, realClientIp, loadBalancerIp' },
    expected: 'realClientIp',
  },
  {
    // Minimal GCLB shape with no attacker-supplied prefix: client IP, then LB IP.
    name: 'two_hop_extracts_client_ip_not_lb_ip',
    headers: { 'x-forwarded-for': '203.0.113.7, 130.211.4.9' },
    expected: '203.0.113.7',
  },
  {
    // Multiple spoofed hops prepended before the two GCLB-appended entries.
    name: 'many_spoofed_hops_still_extracts_second_to_last',
    headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, realClientIp, loadBalancerIp' },
    expected: 'realClientIp',
  },
  {
    // Single hop (no LB entry present) — nothing trustworthy to extract as "second-to-last".
    name: 'single_hop_has_no_second_to_last',
    headers: { 'x-forwarded-for': 'onlyOneIp' },
    expected: null,
  },
  {
    // No X-Forwarded-For at all — falls back to X-Real-IP.
    name: 'falls_back_to_x_real_ip_when_no_xff',
    headers: { 'x-real-ip': 'fallbackIp' },
    expected: 'fallbackIp',
  },
  {
    // Neither header present.
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

  process.stderr.write('\nAll getClientIp() cases correctly extracted the second-to-last hop.\n');
}

main();
